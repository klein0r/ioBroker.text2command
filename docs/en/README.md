![Logo](../../admin/text2command.png)

# ioBroker.text2command

This adapter can convert normal sentences, like `Switch light in kitchen on` to specific command and sets the state `adapter.0.device.kitchenLight` to `true`.

This adapter makes no sense to be activated standalone. It should be used with other adapters like telegram or Android app **`iobroker.vis`**.

## Usage
To execute command, write state **`text2command.<INSTANCE>.text`** with sentence. You will always get the answer in `text2command.<INSTANCE>.response`.

If you define **Answer to ID**, the answer will be written in this ID too. This required for e.g. to realise the voice acknowledges.

You can send a message via `sendTo` from javascript. The answer will come in the message back:

```js
sendTo('text2command', 'Switch light in kitchen on', (err, response) => {
    console.log('Response is: ' + response);
});
```

Regular expressions can be used, like: `/^light\son|^lamp\son/`. Regular expressions are always case-insensitive.

To use "Switch on/off by function" you should care of functions.

Keywords work as following:

- keywords are divided by space
- all keywords must present in a sentence to trigger a rule: e.g. keyword: `light on` will trigger on `switch light on`, `make light on everywhere` and do not trigger on `switch on`, `make light`.
- one keyword can have many forms. Variations of keyword must be divided by "/". E.g. keywords: `switch/make/do light on/true` will trigger on: `do light true`, `make please light on`.
- if keyword can come in many cases(nom, gen, accusative, plural, ...) they all must be listed as variations, like: `switch light/lights on`.

Following functions will be interpreted as

`enum.functions`:

**`enum.functions.light`** (Licht | Свет):

- roles - `level.dimmer`
- roles - `switch.light`

**`enum.functions.backlight`** (Beleuchtung | Подсветка):

- roles - `level.backlight`
- roles - `switch.backlight`

**`enum.functions.blinds/shutter`** (Rollladen | Жалюзи/окна)

- roles - `level.blind`
- roles - `switch.blind`

**`enum.functions.curtain`** (Vorhänge | Шторы)

- roles - `level.curtain`
- roles - `switch.curtain`

**`enum.functions.heating`** (Heizung | Отопление/Подогрев)

- roles - `level.temperature`
- roles - `switch.temperature`

**`enum.functions.music`** (Musik | Музыка)

- roles - `button.play`
- roles - `button.stop` / `button.pause`

**`enum.functions.alarm/security`** (Alarmanlage / Alarm | Охрана)

- roles - `switch.security`

**`enum.functions.lock`** (Schloß / Schloss | Замок)

- roles - `switch.open`
- roles - `switch.lock`

Following rooms are supported:

| key word in phrase    | Possible enum.rooms in english  | in german                | in russian       |
|-----------------------|---------------------------------|--------------------------|------------------|
| everywhere            | everywhere                      | -                        | -                |
| living                | livingroom                      | wohnzimmer               | зал              |
| bedroom               | bedroom/sleepingroom            | schlafzimmer             | спальня          |
| bath                  | bathroom/bath                   | badezimmer/bad           | ванная           |
| working/office        | office                          | arbeitszimmer            | кабинет          |
| kids/child/nursery    | nursery                         | kinderzimmer             | детская          |
| guets wc/guest closet | guestwc                         | gästewc                  | гостевой туалет  |
| wc/closet             | wc                              | wc                       | туалет           |   
| floor/enter           | floor                           | diele/gang/flur          | коридор/прихожая |
| kitchen               | kitchen                         | küche/kueche             | кухня            |
| balcony/terrace/patio | terrace                         | balkon/terrasse          | терраса/балкон  |
| dinning               | dinningroom                     | esszimmer                | столовая         |
| garage                | garage                          | garage                   | гараж            |
| stair                 | stairs                          | trepe/treppenhaus        | лестница         |
| garden                | garden                          | garten                   | сад              |
| court/yard            | court                           | hof                      | двор             |
| guest room            | guestroom                       | gästezimmer              | гостевая         |
| attic                 | attic                           | speicher                 | кладовка         |
| roof                  | roof                            | dachstuhl                | крыша            |
| terminal              | terminal                        | anschlussraum            | сени             |
| wash room             | washroom                        | waschraum                | прачечная        |
| heat room             | heatroom                        | heatingroom/heizungsraum | котельная        |
| hovel                 | hovel                           | schuppen/scheune         | сарай            |
| summer house          | summerhouse                     | gartenhaus               | теплица          |

You can use patterns in acknowledges:

- `%s`: value
- `%u`: unit
- `%n`: name (planned!)
- `{objectId}`: the state of this objectID will be placed here. Actually it will be same bindings supported as by [iobroker.vis](https://github.com/ioBroker/ioBroker.vis#bindings-of-objects), except special bindings.

Following commands are supported:

### What time is it?
Answer: 14:56 (current time)

### What is your name?
Answer is customizable. Default: `My name is Alpha`

### What is the outside temperature?
User must specify the state ID, where to read outside temperature.
Answer is customizable. Default: `Outside temperature is %s %u`
**`%s`** will be replaced by temperature, rounded to integer. **`%u`** will be replaced by units of this state or by system temperature units.

### What is the inside temperature?
User must specify the state ID, where to read inside temperature.
Answer is customizable. Default: `Inside temperature is %s %u`
**`%s`** will be replaced by temperature, rounded to integer. **`%u`** will be replaced by units of this state or by system temperature units.

### Switch on/off by function
This command reads information from enums. It uses `enum.functions` to find type of device (e.g. light, alarm, music) and `enum.rooms` to detect room name.

Keywords to switch on are: *switch on*, e.g. `switch rear light in bath on`

Keywords to switch off are: *switch off*, e.g. `switch light in living room off`

Answer will be generated automatically if desired: `Switch off %function% in %room%`, where `%function%` and `%room%` will be replaced by found device type and location.

Command accept the numeric value too. It has priority, e.g. in command `switch light off in living room on 15%` the light will be set to 15% and not in *off* state.

You can define default room in []. E.g. `switch the light on[sleepingroom]`

### Open/close blinds
This command reads information from enums. It uses **`enum.functions.blind`** to find type blinds or shutter and **`enum.rooms`** to detect room name.

Keywords to move blinds up are: *blinds up*, e.g. `set blinds up in sleeping room`

Keywords to move blinds down are: *blinds down*, e.g. `move blinds down in office`

You can specify the exact position of blind in percent, e.g. `move blinds to 40 percent in office`

Answer will be generated automatically if desired: ` in %room%`, where %room% will be replaced by found device type and location.

### Switch something on/off
User must specify state ID of device, which must be controlled and value, which must be written.

You should create rule for every position (e.g. for `on` and for `off`).

Answer is customizable. Default: `Switched on`

E.g.:
- `Deactivate alarm`, Object ID: `hm-rpc.0.alarm`, Value: `false`, Answer: `Alarm is deactivated/Deactivated`. In this case the answer will be randomized between *Alarm is deactivated* and *Deactivated*.
- `Activate alarm`, Object ID: `hm-rpc.0.alarm`, Value: `true`, Answer: `Alarm is activated/Activated/Done` . In this case the answer will be randomized between *Alarm is activated*, *Activated* and *Done*.

*Deactivate* must be first in the list, because it is longer.

You can use float values in the control commands. If some numeric value will be in the text it will be used as control value and the predefined value will be ignored.

E.G. for rule:

- `Set light level`, Object ID: `hm-rpc.0.light.STATE`, Value: `10`, Answer: `Level set to %s%`.

If command is like `Set light level to 50%`, so into the `hm-rpc.0.light.STATE` will be written 50 and answer will be `Level set to 50%`.

If command is like `Set light level`, so into the `hm-rpc.0.light.STATE` will be written 10 and answer will be `Level set to 10%`.

### Ask about something
User must specify state ID of device, which value will be read.
This template will answer with information from some state.

E.g.:
- `windows opened`, Object ID: `javascript.0.countOpenedWindows`, Acknowledge: `Actual %s windows opened`
- `temperature sleeping room`, Object ID: `hm-rpc.0.sleepingRoomSensor.TEMPERATURE`, Acknowledge: `Actual temperature in sleeping room is %s %u/%s %u`. In this case the answer will be randomized between *Actual temperature in sleeping room is %s %u* and *%s %u*.

### Send text to state
You can write some text into state. User must specify state ID to write text into it.

E.g. rule: `email [to] wife`, Object ID: `javascript.0.emailToWife`, Acknowledge: `Email sent`
Text: `Send email to my wife: I will be late`. Adapter looks for the last word from keywords (in this case `wife`),
extracts text from the next word (in this case `I will be late`) and writes this text into `javascript.0.emailToWife`.
Word `to` is not required to trigger the rule, but will be removed from text.

### You are good (Just for fun)
Answer is customizable. Default: `Thank you` or `You are welcome`

### Thank you (Just for fun)
Answer is customizable. Default: `No problem` or `You are welcome`

### Create answer
You can generate answer with bindings {objectId} in acknowledge. Used for alexa.

E.g.:

- `windows opened`, Acknowledge: `Actual {javascript.0.countOpenedWindows} windows opened`
- `temperature sleeping room`, Acknowledge: `Actual temperature in sleeping room is {t: hm-rpc.0.sleepingRoomSensor.TEMPERATURE; Math.round(t)}/{hm-rpc.0.sleepingRoomSensor.TEMPERATURE; round(1)} degree`. In this case the answer will be randomized between *Actual temperature in sleeping room is <VALUE>* and *<VALUE>*.

You can read more about bindings here: (Bindings of objects)[https://github.com/ioBroker/ioBroker.vis#bindings-of-objects]

Additionally, you can get time until now by `{hm-rpc.0.light.STATE.lc;dateinterval}` (2 minutes and 12 seconds) or `{hm-rpc.0.light.STATE.lc;dateinterval(true)}` (2 minutes and 12 seconds **ago**) 

## External rules with javascript
There is a possibility to use javascript engine to process commands in `text2command`.
To do that you must specify some state in "Processor state ID" (Advanced settings) and to listen on this state in some JS or Blockly script.
You can create some state manually in admin or in script. Processing script can look like this one:

```js
createState("textProcessor", '', function () {
    // text2command writes the value with ack=false. Change "any" is important too, to process repeated commands.
    on({ id: 'javascript.0.textProcessor', ack: false, change: 'any' }, (obj) => {
         var task = JSON.parse(obj.state.val);
         // value looks like
         // {
         //     "command":      "text to process", // command that was received by text2command
         //     "language":     "en",              // language in command or system language
         //     "withLanguage": false              // indicator if language was defined in command (true) or used default language (false)
         // }
         // response to text2command with ack=true
         if (task.command === 'switch light on') {
            setState('hm-rpc.0.light', true);
            setState('javascript.0.textProcessor', 'light is on', true);
         } else {
            // let it process with predefined rules
            setState('javascript.0.textProcessor', '', true);
         }
    });
});
```

Set in settings of `text2command` **Processor state ID** as *`javascript.0.textProcessor`* to let this example work.

First the command will be processed with your javascript and if javascript will answer with '' or not answer in predefined time (1 second by default) the command will be processed by rules.

### Option: Write to response by every command
If activated so by every command (no matter if the request came via state or sendTo) the `text2command.X.response` will be written with the answer.
