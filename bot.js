// Requires
var irc = require('irc'),
    fs = require('fs'),
    config = require("./config");

var ircServer = config.server,
    nick = config.nick,
    options = {
      channels: config.channels,
      autoRejoin: config.autoRejoin,
      port: config.port,
      secure: config.secure,
      autoConnect: false,
      floodProtection: false
    },
    client = new irc.Client(ircServer, nick, options),
    testDay = {
      active: false,
      channel: config.channels[0],
      admins: config.admins,
      helpers: config.helpers,
      start: new Date(),
      end: new Date(2000),
      etherpad: "",
      topic: "",
      topic_backup: "",
      advertisement: config.advertisement
    },
    timerID = 0,
    optOut = [],
    metrics = {
      topic: "",
      etherpad: "",
      start: new Date(2000),
      end: new Date(2000),
      activeUsers: {},
      hourUTC: {},
      firebotBugs: [],
      optOutTotal: 0
    },
    help = { ":help" : "This is Help! :)",
             ":bug"  : "Learn how to report a bug",
             ":qmo"  : "Learn about Quality at Mozilla",
             ":sumo" : "Learn about Support at Mozilla",
             ":join" : "Learn about getting involved with Mozilla QA",
             ":etherpad" : "View the Test Day etherpad",
             ":helpers" : "View Test Day helpers, and request help with :helpers request",
             ":schedule" : "View the Test Day schedule",
             ":optout"   : "Opt out from Test Day data collection for your nick",
             ":optin"    : "Opt in (default) to Test Day data collection for your nick"
    },
    adminhelp = { ":adminhelp" : ":adminhelp: This is Admin Help! :)",
                  ":admin" : ":admin <add|remove> <nickname>: add or remove as a Test Day admin",
                  ":helper": ":helper <add|remove> <nickname>: add or remove as a Test Day helper",
                  ":next"  : ":next <start as YYYY-MM-DDThh:mmZ> <end as YYYY-MM-DDThh:mmZ> <etherpad> <topic>: set next Test Day",
                  ":stats" : ":stats: display Test Day stats",
                  ":stop"  : ":stop: stop Test Day early"
    },
    helperhelp = { ":advertise" : "Advertise the Test Day in other appropriate channels."
    };

function resetData() {
  testDay.admins = config.admins;
  testDay.helpers = config.helpers;
  metrics = {
    topic: testDay.topic,
    etherpad: testDay.etherpad,
    start: new Date(testDay.start),
    end: new Date(testDay.end),
    activeUsers: {},
    hourUTC: {},
    firebotBugs:[],
    optOutTotal: 0
  };

  saveData("metrics", JSON.stringify(metrics));
}

function updateTestDayData() {
  if (testDay.end < Date.now()) {
    testDay.active = false;
    client.send('TOPIC', testDay.channel, testDay.topic_backup);
    client.say(testDay.channel, "The " + testDay.topic + " testday " +
               "has ended. Thank you all for your participation!");
    if (timerID !== 0) {
      clearTimeout(timerID);
      timerID = 0;
    }
  } else {
    testDay.active = true;
    timerID = setTimeout(updateTestDayData, testDay.end - Date.now());
    // if starting a new test day, not restarting
    if (testDay.start > metrics.start) {
      resetData();
      client.send('TOPIC', testDay.channel, "Welcome to the QA channel. " +
                  "Today we are testing " + testDay.topic + ". " +
                  "Please read " + testDay.etherpad + " for more information " +
                  "and ask any questions you have in this channel.");
      client.say(testDay.channel, "The " + testDay.topic + " testday starts "+
                  "now. For details, see " + testDay.etherpad);
    }
  }

  saveData("testDay", JSON.stringify(testDay));
}

client.connect(function () {
  client.say("NickServ", "IDENTIFY " + config.password);
});

restoreTestDayData();

client.addListener('topic', function (aChannel, aChannelTopic, aNick) {
  if (!testDay.active && (aChannel === testDay.channel)) {
    // save a non-Test Day topic to restore after Test Day
    testDay.topic_backup = aChannelTopic;
  }
});

client.addListener('message', function(from, to, message) {
  var intro;

  if (to === nick) { // private message to bot
    to = from;
  }
  if (message.search('[!:]help\\b') >= 0) {
    client.say(to, "Hello, " + from + "! I’ve sent you a private message " +
               "with more help.");

    for (var item in help) {
      client.say(from, item + " : " + help[item]);
    }

    if (testDay.helpers.indexOf(from) >= 0) {
      for (item in helperhelp) {
        client.say(from, item + " : " + helperhelp[item]);
      }
    }

    if (testDay.admins.indexOf(from) >= 0) {
      for (item in adminhelp) {
        client.say(from, adminhelp[item]);
      }
    }
  }

  if (message.search('[!:]bug') >= 0) {
    client.say(to, "You can find details on how to raise a bug at https://developer.mozilla.org/en/Bug_writing_guidelines");
  }
  if (message.search('[!:]sumo') >= 0) {
    client.say(to, "SUMO is short for http://support.mozilla.org, the official, community-powered support website for Mozilla Firefox");
  }
  if (message.search('[!:]qmo') >= 0) {
    client.say(to, "QMO is short for http://quality.mozilla.org, the official destination for everything related with Mozilla QA");
  }

  if (message.search('[!:]join') >= 0) {
    client.say(from, "Mozilla QA is a diverse, open community of people " +
               "pushing the open web forward by ensuring Mozilla produces " +
               "the best technology possible. See " +
               "https://wiki.mozilla.org/QA " +
               "to find out more about getting involved.");
  }

  if (message.search('[!:]etherpad') >= 0) {

    // bot just started, nothing's happened, nothing's scheduled
    if (testDay.start > testDay.end) {
      intro = "No Test Day has been scheduled.";
    } else {
      // default to past Test Day
      intro = "No Test Day is currently scheduled. Last Test Day’s etherpad: ";
    }

    // if today is a Test Day
    if (testDay.active) {
      intro = "Today’s etherpad is ";
    // else if a future Test Day is scheduled
    } else if (testDay.start > Date.now()) {
      intro = "Next Test Day’s etherpad is ";
    }

    client.say(to, intro + testDay.etherpad);
  }

  if (message.search('[!:]helpers') === 0) {
    var command = message.split(" ");
    if (testDay.active) {
      intro = "Today's helpers: ";
      switch (command[1]) {
        case 'request':
          intro = "Help request sent to ";
          testDay.helpers.forEach(function (helper) {
            client.say(helper, from + " could use some help!");
          });
        default:
          client.say(to, intro + testDay.helpers.join([separator = ', ']));
      }
    } else {
      client.say(to, "There's no Test Day in progress.");
    }
  }

  if (message.search('[!:]schedule') >= 0) {
    var scheduleTimes = "";

    // bot just started, nothing's happened, nothing's scheduled
    if (testDay.start > testDay.end) {
      intro = "No Test Day has been scheduled.";
    } else {
      // default to past Test Day
      intro = "No Test Day is currently scheduled. Last";
      scheduleTimes = " Test Day: " + testDay.start.toUTCString() + " till " +
                      testDay.end.toUTCString();
    }

    // if today is a Test Day
    if (testDay.active) {
      intro = "This";
    // else if a future Test Day is scheduled
    } else if (testDay.start > Date.now()) {
      intro = "Next";
    }

    client.say(to, intro + scheduleTimes);
  }

  if (message.search('[!:]optout') === 0) {
    if (optOut.indexOf(from) === -1) {
      optOut.push(from);
      metrics.optOutTotal += 1;
      if (from in metrics.activeUsers) {
        delete metrics.activeUsers[from];
      }

      saveData("optOut", JSON.stringify(optOut));
    }
    client.say(from, "You’ve opted out of Test Day data collection " +
               "for your nick " + from + ". You can opt in again using " +
               "the command :optin.");
  }

  if (message.search('[!:]optin') === 0) {
    if (optOut.indexOf(from) >= 0) {
      optOut.splice(optOut.indexOf(from), 1);
      // on Test Days, add to metrics to avoid second(?) opt out notice
      if (testDay.active) {
        metrics.activeUsers[from] = 0;
      }

      saveData("optOut", JSON.stringify(optOut));
    }
    client.say(from, "You’re opted in to Test Day data collection " +
               "for your nick " + from + ".");
  }

  if (testDay.active) {
    if (from === 'firebot') {
      var matches = /^(https:\/\/bugzil.la\/|Bug )(\d+)/i.exec(message);
      if (matches) {
        metrics.firebotBugs.push(matches[2]);
      }
    }

    // if from is not on the opt out list
    if (optOut.indexOf(from) === -1) {
      if (from in metrics.activeUsers) {
        metrics.activeUsers[from] += 1;
      } else {
        client.say(from, "Welcome to today’s Test Day, " + from + "!");
        client.say(from, "To opt out of data collection, use the command :optout.");
        metrics.activeUsers[from] = 1;
      }
    }

    var nowHour = new Date().getUTCHours().toString();
    if (nowHour in metrics.hourUTC) {
      metrics.hourUTC[nowHour] += 1;
    } else {
      metrics.hourUTC[nowHour] = 1;
    }

    saveData("metrics", JSON.stringify(metrics));
  }
});

client.addListener('pm', function(from, message) { // private messages to bot
  var command = message.split(" ");

  if (!((command[0] in adminhelp) || (command[0] in helperhelp))) {
    // not a privileged command
    return;
  }

  if (!((testDay.admins.indexOf(from) >= 0) || (testDay.helpers.indexOf(from) >= 0))) {
    client.say(from, "Sorry! " + from + " is not a Test Day admin or helper.");
    return;
  }

  client.whois(from, function(whoisinfo) {
    if (!(whoisinfo.accountinfo && whoisinfo.accountinfo.search('is logged in as') >= 0)) {
      client.say(from, "Sorry! You're not logged in with a registered nick.");
      return;
    }

    var cmdLen = command.length;

    // :advertise is the only helper command; run it without further check
    if (command[0] === ":advertise") {
      client.say(from, 'Sending "' + testDay.advertisement.message +
                 '" to ' + testDay.advertisement.channels.join(", "));
      testDay.advertisement.channels.forEach(function (aChannel){
        client.join(aChannel, function() {
          client.say(aChannel, testDay.advertisement.message);
          client.part(aChannel);
        });
      });
      return;
    }

    // other privileged commands are admin-only; return if not from admin
    if (!(testDay.admins.indexOf(from) >= 0)) {
      return;
    }

    // admin commands
    switch (command[0]) {
      case ":adminhelp":
        for (var item in adminhelp) {
          client.say(from, adminhelp[item]);
        }
        break;

      case ":admin":
        if (cmdLen != 3) {
          client.say(from, "Need some help? " + adminhelp[command[0]]);
          return;
        }
        switch (command[1]) {
          case "add":
            if (testDay.admins.indexOf(command[2]) === -1) {
              testDay.admins.push(command[2]);
            }
            break;
          case "remove":
            var index = testDay.admins.indexOf(command[2]);
            if (index >= 0) {
              testDay.admins.splice(index, 1);
            }
            break;
          default:
            client.say(from, "Need some help? " + adminhelp[command[0]]);
        }
        client.say(from, 'Test Day admins are ' + testDay.admins.join(", "));
        break;

      case ":helper":
        if (cmdLen != 3) {
          client.say(from, "Need some help? " + adminhelp[command[0]]);
          return;
        }
        switch (command[1]) {
          case "add":
            if (testDay.helpers.indexOf(command[2]) === -1) {
              testDay.helpers.push(command[2]);
            }
            break;
          case "remove":
            var index = testDay.helpers.indexOf(command[2]);
            if (index >= 0) {
              testDay.helpers.splice(index, 1);
            }
            break;
          default:
            client.say(from, "Need some help? " + adminhelp[command[0]]);
        }
        client.say(from, 'Test Day helpers are ' + testDay.helpers.join(", "));
        break;

      case ":stats":
        var stats = new Stats();
        stats.generateStats(metrics, from);
        break;

      case ":stop":
        if (testDay.active) {
          testDay.end = new Date();
          metrics.end = testDay.end.toUTCString();

          saveData("metrics", JSON.stringify(metrics));

          updateTestDayData();

          client.say(from, "Test Day stopped.");
        } else {
          client.say(from, "No Test Day is in progress.");
        }
        break;

      case ":next":
        if (testDay.active) {
          client.say(from, "Test Day in progress and scheduled to end " + testDay.end);
        } else {
          if (cmdLen >= 5) {
            var startTime = new Date(command[1]);
            var endTime = new Date(command[2]);
            var dateErrors = [];
            if (endTime < startTime) {
              dateErrors.push("Start time is set after end time.");
            }
            if (startTime < Date.now()) {
              dateErrors.push("Start time is set in the past.");
            }
            // if the start and end dates appear valid, set the test day date
            if (dateErrors.length == 0) {
              if (timerID !== 0) {
                clearTimeout(timerID);
              }
              testDay.start = startTime;
              testDay.end = endTime;
              testDay.etherpad = command[3];
              testDay.topic = command.slice(4, cmdLen).join(" ");
              timerID = setTimeout(updateTestDayData, testDay.start - Date.now());
              client.say(from, "Next Test Day's start is " + testDay.start.toUTCString());
              client.say(from, "Next Test Day's end is " + testDay.end.toUTCString());
              client.say(from, "Next Test Day's etherpad is " + testDay.etherpad);
              client.say(from, "Next Test Day's topic is " + testDay.topic);
            }
            else {
              client.say(from, "Please use valid dates:\n" + dateErrors.join("\n"));
            }
          } else {
            client.say(from, "Need some help? " + adminhelp[command[0]]);
          }
        }
        break;

      default:
        client.say(from, "Oops! I don't really know how to " + message + ".");
    }

    saveData("testDay", JSON.stringify(testDay));
  });
});

client.addListener('error', function(message) {
  console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

var Stats = function() {};

Stats.prototype.generateStats = function(metrcs, from) {
  var keys = Object.keys(metrcs);
  var what = Object.prototype.toString;
  var report ="";
  var t = 0;

  for (var i = 0; i < keys.length; i++) {
    if (what.call(metrcs[keys[i]]).search('Array') > 0) {
      report = report + keys[i] + ":  " + metrcs[keys[i]].join(", ") + "\n";
    } else {
      if (keys[i] == "activeUsers") {
        var speakers = Object.keys(metrcs.activeUsers);
        var speakersTotal = speakers.length;
        report = report + "The following " + speakersTotal + " people were active in the channel:  ";
        for (t = 0; t < speakersTotal; t++) {
          var sep = (t === speakersTotal - 1) ? "\n" : ", ";
          report = report + speakers[t] + ": " + metrcs.activeUsers[speakers[t]] + sep;
        }
      } else if (keys[i] == "hourUTC") {
        report = report + "The following hours (UTC) were active in the channel:  ";
        speakers = Object.keys(metrcs.hourUTC);
        speakersTotal = speakers.length;
        for (t = 0; t < speakersTotal; t++) {
          sep = (t === speakersTotal - 1) ? "\n" : ", ";
          report = report + speakers[t] + ": " + metrcs.hourUTC[speakers[t]] + sep;
        }
      } else {
        report = report + keys[i] + ": " + metrcs[keys[i]] + "\n";
      }
    }
  }
  client.say(from, report);
};

function restoreTestDayData() {
  var data = readData("optOut");
  if (data) {
    optOut = data;
  }

  data = readData("testDay");
  if (data) {
    testDay = data;
    // Date objects don't survive JSON stringify/parse
    testDay.start = new Date(testDay.start);
    testDay.end = new Date(testDay.end);
  }

  data = readData("metrics");
  if (data) {
    metrics = data;
    // Date objects don't survive JSON stringify/parse
    metrics.start = new Date(metrics.start);
    metrics.end = new Date(metrics.end);
  }

  if (testDay.start > Date.now()) {
    // if a future Test Day has been scheduled
    timerID = setTimeout(updateTestDayData, testDay.start - Date.now());

  } else if (testDay.end > Date.now()) {
    // else if Test Day has not ended
    updateTestDayData();
  }
}

function saveData(datastore, data) {
  var filename = "./data/" + datastore + ".json";

  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", "0750");
  }

  fs.writeFile(filename, data, function(err){
    if (err) {
      console.error("Error writing " + filename);
    }
  });
}

function readData(datastore) {
  var filename = "./data/" + datastore + ".json";
  var data;

  if (fs.existsSync(filename)) {
    data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  }
}
