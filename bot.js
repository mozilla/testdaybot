// Requires
var irc = require('irc')
  , http = require('http');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {
      channels: ['#testdaybotTest'], // for testing; to be run in #qa?
      autoRejoin: true,
    },
    client = new irc.Client(ircServer, nick, options),
    lastQuit = {},
    etherpad = process.argv[2],
    metrics = {
      greetedName: [],
      greetedNumber: 0,
      firebotBugs:[],
      usersTalked: {},
      hourUTC: {},
    },
    testDay = false,
    testDayAdmins = ["ashughes", "whimboo", "galgeek"],
    helpers = ["ashughes"],
    startTime = Date.now(),
    endTime = startTime,
    runTime = 0;

function checkTestDay() {
  if (testDay){
    if (Date.now() > endTime){
      testDay = false;
    }
  } else {
    if (Date.now() < endTime && Date.now() > startTime){
      testDay = true;
      // re-initialize stats-related variables
      lastQuit = {};
      metrics = {
        greetedName: [],
        greetedNumber: 0,
        firebotBugs:[],
        usersTalked: {},
        hourUTC: {},
      };
    }
  }
}

client.addListener('join', function(channel, who){
  checkTestDay();
  if (testDay){ // greet people only on test days
    if (who !== nick){
      var lastMessageTime = Date.now() - lastQuit[who];

      if (lastQuit[who]){
        switch (true){
          case (lastMessageTime < 1800000):
            break;
          case (lastMessageTime < runTime):
            setTimeout(function(){
              client.say(channel, "Welcome back to the Test Day " + who + "!");
            }, 2000);
            break;
        }
      } else {
        console.log("Greeted " + who);
        setTimeout(function(){
          client.say(channel, "Welcome to the Test Day " + who + "! Details of the Test Day can be found at " + etherpad);
          }, 2000);
        metrics.greetedName.push(who);
        metrics.greetedNumber +=1;
      }
    }
  }
});

client.addListener('message', function(from, to, message){
  checkTestDay();
  if (message.search('[!:]help') >= 0){
    client.say(to, "Commands I know:\n :bug\n :qmo\n :sumo\n :etherpad (test days)");
  }
  if (message.search('[!:]bug') >= 0){
    client.say(to, "You can find details on how to raise a bug at https://developer.mozilla.org/en/Bug_writing_guidelines");
  }
  if (message.search('[!:]sumo') >= 0){
    client.say(to, "SUMO is short for http://support.mozilla.org, the official, community-powered support website for Mozilla Firefox");
  }
  if (message.search('[!:]qmo') >= 0){
    client.say(to, "QMO is short for http://quality.mozilla.org, the official destination for everything related with Mozilla QA");
  }
  if (testDay){
    if (message.search('[!:]etherpad') >= 0){
      client.say(to, "Today's etherpad is " + etherpad);
    }
    if (from === 'firebot'){
      if (message.search(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i) >= 0){
        metrics.firebotBugs.push(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i.exec(message)[1]);
      }
    }
    if (from in metrics.usersTalked) {
      metrics.usersTalked[from] += 1;
    } else {
      metrics.usersTalked[from] = 1;
    }
    var nowHour = new Date().getUTCHours().toString();
    if (nowHour in metrics.hourUTC) {
      metrics.hourUTC[nowHour] += 1;
    } else {
      metrics.hourUTC[nowHour] = 1;
    }
  }
});

client.addListener('pm', function(from, message){ // private messages to bot
  checkTestDay();
  if (testDayAdmins.indexOf(from) >= 0){
    if (message.search(':adminhelp') === 0){
      client.say(from, "admin commands:\n  :addAdmin <nickname>\n  :addHelper <nickname>\n" + 
                       "  :next <start as YYYY-MM-DDThh:mmZ> <end as YYYY-MM-DDThh:mmZ> <etherpad> <topic>\n" + 
                       "  :start <etherpad> <topic>\n  :stats\n  :stop");
      return;
    }
    if (message.search(':addAdmin') === 0){
      addTestDayAdmin = message.slice(message.indexOf(" ") + 1);
      testDayAdmins.push(addTestDayAdmin);
      client.say(from, 'test day admins are now ' + testDayAdmins.toString());
      return;
    }
    if (message.search(':addHelper') === 0){
      addHelper = message.slice(message.indexOf(" ") + 1);
      helpers.push(addHelper);
      client.say(from, 'test day helpers are now ' + helpers.toString());
      return;
    }
    if (message.search(':stats') === 0){
      var stats = new Stats();
      stats.generateStats(metrics, from);
      return;
    }
    if (testDay){
      if (message.search(':stop') === 0){
        testDay = false;
        client.say(from, "testDay is now " + testDay.toString());
        return;
      }
    } else {
      if (message.search(':start') === 0){
        testDay = true;
        args = message.slice(message.indexOf(" ") + 1);
        etherpad = args.slice(0, args.indexOf(" "));
        topic = args.slice(args.indexOf(" ") + 1);
        startTime = Date.now();
        runTime = 1000 * 60 * 60 * 20;  // default: 20 hours
        endTime = startTime + runTime;
        // re-initialize stats-related variables
        lastQuit = {};
        metrics = {
          greetedName: [],
          greetedNumber: 0,
          firebotBugs:[],
          usersTalked: {},
          hourUTC: {},
        };
        // TODO: other initialization?
        client.say(from, "testDay is now " + testDay.toString());
        client.say(from, "Today's etherpad is " + etherpad);
        client.say(from, "Today's topic is " + topic);
        return;
      }
      if (message.search(':next') === 0){
        args = message.slice(message.indexOf(" ") + 1);
        startTime = new Date(args.slice(0, args.indexOf(" ")));
        args = args.slice(args.indexOf(" ") + 1);
        endTime = new Date(args.slice(0, args.indexOf(" ")));
        args = args.slice(args.indexOf(" ") + 1);
        etherpad = args.slice(0, args.indexOf(" "));
        topic = args.slice(args.indexOf(" ") + 1);
        client.say(from, "Next test day's start is " + startTime);
        client.say(from, "Next test day's end is " + endTime);
        client.say(from, "Next test day's etherpad is " + etherpad);
        client.say(from, "Next test day's topic is " + topic);
      }
    }
  }
});

client.addListener('quit', function(who, reason, channel){
  checkTestDay();
  if (testDay){
    lastQuit[who] = Date.now();
  }
});

client.addListener('part', function(channel, who, reason){
  checkTestDay();
  if (testDay){
    lastQuit[who] = Date.now();
  }
});

client.addListener('error', function(message){
  console.error(message);
});

var Stats = function(){};

Stats.prototype.generateStats = function(metrcs, from){
  metrcs.testday = etherpad;

  var keys = Object.keys(metrcs);
  var what = Object.prototype.toString;
  for (var i = 0; i < keys.length; i++){
    if (what.call(metrcs[keys[i]]).search('Array') > 0){
      client.say(from, keys[i] + ":  " + metrcs[keys[i]].join(", "));
    } else {
      if (keys[i] == "usersTalked"){
        client.say(from, "The following people were active in the channel: ");
        var speakers = Object.keys(metrcs.usersTalked);
        for (var t = 0; t < speakers.length; t++){
          client.say(from, speakers[t] + ": " + metrcs.usersTalked[speakers[t]]);
        }
      } else if (keys[i] == "hourUTC") {
        client.say(from, "The following hours were active in the channel: ");
        var speakers = Object.keys(metrcs.hourUTC);
        for (var t = 0; t < speakers.length; t++){
          client.say(from, speakers[t] + ": " + metrcs.hourUTC[speakers[t]]);
        }
      } else {
        client.say(from, keys[i] + ": " + metrcs[keys[i]]);
      }
    }
  }
};
