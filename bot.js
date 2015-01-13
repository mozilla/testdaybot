// Requires
var irc = require('irc'),
    http = require('http'),
    config = require("./config");

var ircServer = config.server,
    nick = config.nick,
    options = {
      channels: config.channels,
      autoRejoin: config.autoRejoin,
      floodProtection: false
    },
    client = new irc.Client(ircServer, nick, options),
    channel = config.channels[0],
    etherpad = "",
    testDay = false,
    admins = config.admins,
    helpers = config.helpers,
    advertisement = config.advertisement,
    startTime = Date.now(),
    endTime = startTime,
    timerID = 0,
    topic = "",
    topic_backup = "",
    optOut = {},
    lastQuit = {},
    metrics = {
      firebotBugs:[],
      activeUsers: {},
      hourUTC: {},
      optOutTotal: 0,
    },
    help = { ":help" : "This is Help! :)",
             ":bug"  : "Learn how to report a bug",
             ":qmo"  : "Learn about Quality at Mozilla",
             ":sumo" : "Learn about Support at Mozilla",
             ":etherpad" : "View the Test Day etherpad",
             ":helpers" : "View Test Day helpers, and request help with :helpers request",
             ":schedule" : "View the Test Day schedule",
             ":optout"   : "Opt out from Test Day data collection for your nick"
    },
    adminhelp = { ":adminhelp" : "This is Admin Help! :)",
                  ":addAdmin" : ":addAdmin <nickname> as a Test Day admin",
                  ":addHelper" : ":addHelper <nickname> as a Test Day helper",
                  ":next" : ":next <start as YYYY-MM-DDThh:mmZ> <end as YYYY-MM-DDThh:mmZ> <etherpad> <topic> as next Test Day",
                  ":stats" : ":stats display Test Day stats",
                  ":stop" : ":stop Test Day early"
    },
    helperhelp = { ":advertise" : "Advertise the Test Day in other appropriate channels."
    };

function resetData() {
  admins = config.admins;
  helpers = config.helpers;
  lastQuit = {};
  metrics = {
    firebotBugs:[],
    activeUsers: {},
    hourUTC: {},
    optOutTotal: 0,
    start: startTime.toUTCString(),
    end: endTime.toUTCString(),
    etherpad: etherpad,
    topic: topic,
  };
}

function updateTestDayData() {
  if (testDay) {
    testDay = false;
    client.send('TOPIC', channel, topic_backup);
    if (timerID !== 0) {
      clearTimeout(timerID);
      timerID = 0;
    }
  } else {
    testDay = true;
    resetData();
    client.send('TOPIC', channel, topic);
    timerID = setTimeout(updateTestDayData, endTime - Date.now());
  }
}

client.addListener('topic', function (aChannel, aChannelTopic, aNick) {
  if (!testDay && (aChannel === channel)){
    // save a non-Test Day topic to restore after Test Day
    topic_backup = aChannelTopic;
  }
});

client.addListener('message', function(from, to, message) {
  var intro;

  if (to === nick) { // private message to bot
    to = from;
  }
  if (message.search('[!:]help\\b') >= 0) {
    for (var item in help) {
      client.say(from, item + " : " + help[item]);
    }

    if (helpers.indexOf(from) >= 0) {
      for (item in helperhelp) {
        client.say(from, item + " : " + helperhelp[item]);
      }
    }

    if (admins.indexOf(from) >= 0) {
      for (item in adminhelp) {
        client.say(from, item + " : " + adminhelp[item]);
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
  if (message.search('[!:]etherpad') >= 0) {
    if (etherpad) {
      if (testDay) {
        client.say(to, "Today's etherpad is " + etherpad);
      } else {
        client.say(to, "Next Test Day's etherpad is " + etherpad);
      }
    } else {
      client.say(to, "No etherpad is set.");
    }
  }
  if (message.search('[!:]helpers') === 0) {
    var command = message.split(" ");
    if (testDay) {
      intro = "Today's helpers: ";
      switch (command[1]) {
        case 'request':
          intro = "Help request sent to ";
          helpers.forEach(function (helper) {
            client.say(helper, from + " could use some help!");
          });
        default:
          client.say(to, intro + helpers.join([separator = ', ']));
      }
    } else {
      client.say(to, "There's no Test Day in progress.");
    }
  }

  if (message.search('[!:]schedule') >= 0) {
    var scheduleTimes = "";

    // bot just started, nothing's happened, nothing's scheduled
    if (endTime === startTime) {
      intro = "No Test Day has been scheduled.";
    } else {
      // default to past Test Day
      intro = "No Test Day is currently scheduled. Last";
      scheduleTimes = " Test Day: " + startTime.toUTCString() + " till " +
                      endTime.toUTCString();
    }

    // if today is a Test Day
    if (testDay) {
      intro = "This";
    // else if a future Test Day is scheduled
    } else if (startTime > Date.now()) {
      intro = "Next";
    }

    client.say(to, intro + scheduleTimes);
  }

  if (message.search('[!:]optout') === 0) {
    if (!(from in optOut)) {
      optOut[from] = null;
      metrics.optOutTotal += 1;
      if (from in metrics.activeUsers) {
        delete metrics.activeUsers[from];
      }
    }
    client.say(from, "You’ve opted out of Test Day data collection " +
    "for your nick " + from + ".");
  }

  if (testDay) {
    if (from === 'firebot') {
      if (message.search(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i) >= 0) {
        metrics.firebotBugs.push(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i.exec(message)[1]);
      }
    }

    // if from is not on the opt out list
    if (!(from in optOut)) {
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
  }
});

client.addListener('pm', function(from, message) { // private messages to bot
  var command = message.split(" ");

  if (!((command[0] in adminhelp) || (command[0] in helperhelp))) {
    // not a privileged command
    return;
  }

  if (!((admins.indexOf(from) >= 0) || (helpers.indexOf(from) >= 0))) {
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
      advertisement.channels.forEach(function (aChannel){
        client.join(aChannel, function() {
          client.say(aChannel, advertisement.message);
          client.part(aChannel);
        });
      });
      return;
    }

    // other privileged commands are admin-only; return if not from admin
    if (!(admins.indexOf(from) >= 0)) {
      return;
    }

    // admin commands
    switch (command[0]) {
      case ":adminhelp":
        for (var item in adminhelp) {
          client.say(from, adminhelp[item]);
        }
        break;
      case ":addAdmin":
        if (cmdLen != 2) {
          client.say(from, "Need some help? " + adminhelp[command[0]]);
        } else {
          admins.push(command[1]);
          client.say(from, 'Test Day admins are now ' + admins.join(", "));
        }
        break;
      case ":addHelper":
        if (cmdLen != 2) {
          client.say(from, "Need some help? " + adminhelp[command[0]]);
        } else {
          helpers.push(command[1]);
          client.say(from, 'Test Day helpers are now ' + admins.join(", "));
        }
        break;
      case ":stats":
        var stats = new Stats();
        stats.generateStats(metrics, from);
        break;
      case ":stop":
        if (testDay) {
          updateTestDayData();
          client.say(from, "Test Day stopped.");
        } else {
          client.say(from, "No Test Day is in progress.");
        }
        break;
      case ":next":
        if (testDay) {
          client.say(from, "Test Day in progress and scheduled to end " + endTime);
        } else {
          if (cmdLen >= 5) {
            startTime = new Date(command[1]);
            endTime = new Date(command[2]);
            etherpad = command[3];
            topic = message.slice(message.indexOf(etherpad) + etherpad.length + 1);
            // if the start and end dates appear valid, set the test date
            if ((endTime > startTime) && (startTime > Date.now())) {
              if (timerID !== 0) {
                clearTimeout(timerID);
              }
              timerID = setTimeout(updateTestDayData, startTime - Date.now());
              client.say(from, "Next Test Day's start is " + startTime);
              client.say(from, "Next Test Day's end is " + endTime);
              client.say(from, "Next Test Day's etherpad is " + etherpad);
              client.say(from, "Next Test Day's topic is " + topic);
            } else {
              client.say(from, "Please use valid dates.");
            }
          } else {
            client.say(from, "Need some help? " + adminhelp[command[0]]);
          }
        }
        break;
      default:
        client.say(from, "Oops! I don't really know how to " + message + ".");
    }
  });
});

client.addListener('quit', function(who, reason, aChannel){
  if (testDay){
    lastQuit[who] = Date.now();
  }
});

client.addListener('part', function(aChannel, who, reason){
  if (testDay){
    lastQuit[who] = Date.now();
  }
});

client.addListener('error', function(message) {
  console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

var Stats = function() {};

Stats.prototype.generateStats = function(metrcs, from) {
  var keys = Object.keys(metrcs);
  var what = Object.prototype.toString;
  for (var i = 0; i < keys.length; i++) {
    if (what.call(metrcs[keys[i]]).search('Array') > 0) {
      client.say(from, keys[i] + ":  " + metrcs[keys[i]].join(", "));
    } else {
      if (keys[i] == "activeUsers") {
        var speakers = Object.keys(metrcs.activeUsers);
        var speakersTotal = speakers.length;
        client.say(from, "The following " + speakersTotal + " people were active in the channel: ");
        for (var t = 0; t < speakersTotal; t++) {
          client.say(from, speakers[t] + ": " + metrcs.activeUsers[speakers[t]]);
        }
      } else if (keys[i] == "hourUTC") {
        client.say(from, "The following hours (UTC) were active in the channel: ");
        var speakers = Object.keys(metrcs.hourUTC);
        for (var t = 0; t < speakers.length; t++) {
          client.say(from, speakers[t] + ": " + metrcs.hourUTC[speakers[t]]);
        }
      } else {
        client.say(from, keys[i] + ": " + metrcs[keys[i]]);
      }
    }
  }
};
