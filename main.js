'use strict';

const utils           = require('@iobroker/adapter-core');
const adapterName     = require('./package.json').name.split('.').pop();

const model           = require('./admin/langModel');
const devicesControl  = require('./lib/devicesControl');
const simpleControl   = require('./lib/simpleControl');
const simpleAnswers   = require('./lib/simpleAnswers');

let rules;
let commandsCallbacks;
let systemConfig    = {};
let enums           = {};
let processTimeout  = null;
let processQueue    = [];

class Text2Command extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: adapterName,
            useFormatDate: true,
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        rules = this.config.rules || {};
        commandsCallbacks = {
            whatTimeIsIt:       simpleControl.sayTime,
            whatIsYourName:     simpleControl.sayName,
            outsideTemperature: simpleControl.sayTemperature,
            insideTemperature:  simpleControl.sayTemperature,
            functionOnOff:      devicesControl.controlByFunction,
            blindsUpDown:       devicesControl.controlBlinds,
            userDeviceControl:  simpleControl.userDeviceControl,
            sendText:           simpleControl.sendText,
    /*        openLock:           openLock,*/
            userQuery:          simpleControl.userQuery,
            buildAnswer:        simpleControl.buildAnswer
        };
    
        // read system configuration
        const obj = await this.getForeignObjectAsync('system.config');

        systemConfig = (obj ? obj.common : {}) || {};
        simpleControl.init(systemConfig, adapter);
    
        // read all enums
        const enums = await this.getEnumsAsync('');
        devicesControl.init(enums, adapter);
    
        await this.subscribeForeignObjectsAsync('enum.*');

        if (this.config.processorId) {
            await this.subscribeForeignStatesAsync(this.config.processorId);
        }

        this.subscribeStates(this.namespace + '.text')
    }

    /**
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        if (state && !state.ack && state.val && id === this.namespace + '.text') {
            processText(state.val.toString(), sayIt);
        } else if (state && id === this.config.processorId && state.ack) {
            // answer received
            if (processTimeout) {
                clearTimeout(processTimeout);
                processTimeout = null;
                let task = processQueue.shift();
                if (state.val || state.val === '' || state.val === 0) {
                    if (task.callback) {
                        task.callback((task.withLanguage ? `${task.language};` : '') + state.val);
                    }
                } else {
                    processText((task.withLanguage ? `${task.language};` : '') + task.command, task.callback, null, null, true);
                }
                setImmediate(useExternalProcessor);
            }
        }
    }

    /**
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (id.substring(0, 5) === 'enum.') {
            // read all enums
            this.getEnums('', (err, list) => {
                enums = list;
                devicesControl.init(enums);
            });
        }
    }

    /**
     * @param {ioBroker.Message} obj
     */
    onMessage(obj) {
        if (obj) {
            switch (obj.command) {
                case 'send':
                    if (obj.message) {
                        processText(typeof obj.message === 'object' ? obj.message.text : obj.message, res => {
                            let responseObj = JSON.parse(JSON.stringify(obj.message));
                            if (typeof responseObj !== 'object') {
                                responseObj = {text: responseObj};
                            }

                            responseObj.response = res;

                            if (obj.callback) {
                                this.sendTo(obj.from, obj.command, responseObj, obj.callback);
                            }
                        }, typeof obj.message === 'object' ? JSON.parse(JSON.stringify(obj.message)) : null, obj.from);
                    }
                    break;

                default:
                    this.log.warn(`Unknown command: ${obj.command}`);
                    break;
            }
        }
    }

    sayIt(text) {
        this.setStateAsync('response', text || '', true)
            .then(() => {
                if (text && this.config.sayitInstance) {
                    return this.getForeignObjectAsync(this.config.sayitInstance)
                        .then(obj => {
                            if (obj) {
                                return this.setForeignStateAsync(this.config.sayitInstance, text);
                            } else {
                                this.log.warn('If you want to use sayit functionality, please install sayit or disable it in settings (Answer in id)');
                            }
                        });
                }
            })
            .catch(err => this.log.error(err));
    }
    
    useExternalProcessor() {
        if (!processTimeout && processQueue.length) {
            let task = processQueue[0];
    
            // send task to external processor
            this.setForeignState(this.config.processorId, JSON.stringify(task));
    
            // wait x seconds for answer
            processTimeout = setTimeout(() => {
                processTimeout = null;
    
                // no answer in given period
                let _task = processQueue.shift();
    
                // process with rules
                processText((_task.withLanguage ? `${_task.language};` : '') + _task.command, _task.callback, null, null, true);
    
                // process next
                useExternalProcessor();
            }, this.config.processorTimeout || 1000);
        }
    }
    
    processText(cmd, cb, messageObj, from, afterProcessor) {
        this.log.info(`processText: "${cmd}"`);
    
        let lang = this.config.language || systemConfig.language || 'en';
        if (cmd === null || cmd === undefined) {
            this.log.error('processText: invalid command!');
            this.setState('error', { val: 'invalid command', ack: true });

            return simpleAnswers.sayError(lang, 'processText: invalid command!', null, null, result =>
                cb(result ? ((withLang ? `${lang};` : '') + result) : ''));
        }

        cmd = cmd.toString();
        let originalCmd = cmd;

        let withLang = false;
        let ix       = cmd.indexOf(';');

        cmd = cmd.toLowerCase();

        // extract language
        if (ix !== -1) {
            withLang    = true;
            lang        = cmd.substring(0, ix) || lang;
            cmd         = cmd.substring(ix + 1);
            originalCmd = originalCmd.substring(ix + 1);
        }

        // if desired processing by javascript
        if (!afterProcessor && this.config.processorId) {
            let task = messageObj || {};
    
            task.language     = lang;
            task.command      = originalCmd;
            task.withLanguage = withLang;
            task.from         = from;
            task.callback     = cb;
    
            if (processQueue.length < 100) {
                processQueue.push(task);
                return useExternalProcessor();
            } else {
                this.log.error('External process queue is full. Try to use rules.');
            }
        } else if (afterProcessor) {
            this.log.warn(`Timeout for external processor: ${this.config.processorId}`);
        }
    
        let matchedRules = model.findMatched(cmd, rules);
        let result = '';
        let count = matchedRules.length;
    
        for (let m = 0; m < matchedRules.length; m++) {
            if (model.commands[rules[matchedRules[m]].template] && model.commands[rules[matchedRules[m]].template].extractText) {
                cmd = simpleControl.extractText(cmd, originalCmd, rules[matchedRules[m]].words);
            }
    
            if (commandsCallbacks[rules[matchedRules[m]].template]) {
                commandsCallbacks[rules[matchedRules[m]].template](lang, cmd, rules[matchedRules[m]].args, rules[matchedRules[m]].ack, response => {
                    this.log.info(`Response: ${response}`);
    
                    // somehow combine answers
                    if (response) {
                        result += (result ? ', ' : '') + response;
                    }
    
                    this.config.writeEveryAnswer && this.setState('response', response, true);
    
                    if (!--count) {
                        cb && cb(result ? ((withLang ? `${lang};` : '') + result) : '');
                        cb = null;
                    }
                });
            } else {
                count--;
                if (rules[matchedRules[m]].ack) {
                    result += (result ? ', ' : '') + simpleAnswers.getRandomPhrase(rules[matchedRules[m]].ack);
                }
            }
        }
    
        if (!matchedRules.length) {
            if (!this.config.noNegativeMessage) {
                simpleAnswers.sayIDontUnderstand(lang, cmd, null, null, result => {
                    cb && cb(result ? ((withLang ? `${lang};` : '') + result) : '');
                    cb = null;
                });
            } else {
                cb && cb('');
                cb = null;
            }
        } else if (!count) {
            cb && cb(result ? ((withLang ? `${lang};` : '') + result) : '');
            cb = null;
        }
    }

    /**
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if (processTimeout) {
                clearTimeout(processTimeout);
                processTimeout = null;
            }

            callback();
        } catch (e) {
            callback();
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Text2Command(options);
} else {
    // otherwise start the instance directly
    new Text2Command();
}
