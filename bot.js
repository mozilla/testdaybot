// Requires
var irc = require('irc'),
    http = require('http');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {
      channels: ['#testdaybotTest'], // TODO: #qa for production?
      autoRejoin: true,
    },
    client = new irc.Client(ircServer, nick, options),
    etherpad = process.argv[2];
    lastQuit = {},
    metrics = {
      greetedName: [],
      greetedNumber: 0,
      firebotBugs:[],
      usersTalked: {},
      hourUTC: {},
    },
    testDay = false,
    testDayAdmin = false,
    testDayAdmins = ["ashughes", "whimboo", "galgeek"],
    RUNNING_TIME = 1000 * 60 * 60 * 20; // 20 = hours to run Test Day

function checkTestDay() {
  if (testDay){
    if (Date.now() - startTime > RUNNING_TIME){
      testDay = false;
    }
  }
}

client.addListener('join', function(channel, who){
  checkTestDay();
  if (testDay){ // greet people on test days only
    if (who !== nick){
      var lastMessageTime = Date.now() - lastQuit[who];

      if (lastQuit[who]){
        switch (true){
          case (lastMessageTime < 1800000):
            break;
          case (lastMessageTime < RUNNING_TIME):
            setTimeout(function(){
              client.say(channel, "Welcome back to the Test Day, " + who + "!");
            }, 2000);
            break;
        }
      } else {
        console.log("Greeted " + who);
        setTimeout(function(){
          client.say(channel, "Welcome to the Test Day, " + who + "! Details of the Test Day can be found at " + etherpad);
          }, 2000);
        metrics.greetedName.push(who);
        metrics.greetedNumber +=1;
      }
    }
  }
});

client.addListener('message', function(from, to, message){
  checkTestDay();
  if (testDay){ // collect stats on test days only
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

  if (to === nick){ // handle private messages to _TestDayBot
    to = from;
  }

  if (from === 'firebot'){ // does this do anything without another bot running in the channel?
    if (message.search(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i) >= 0){
      metrics.firebotBugs.push(/https:\/\/bugzilla.mozilla.org\/show_bug.cgi\?id=(\d+)/i.exec(message)[1]);
    }
  }

  if (message.search('[!:]help') === 0){
    client.say(to, "commands I know:\n:help - print this list\n:bug - learn how to report a bug\n:etherpad - show today's etherpad\n:sumo - show link to SUMO\n:qmo - show link to QMO");
    return;
  }
  if (message.search('[!:]bug') === 0){
    client.say(to, "You can find details on how to raise a bug at https://developer.mozilla.org/en/Bug_writing_guidelines");
    return;
  }
  if (message.search('[!:]etherpad') === 0){
    client.say(to, "Today's etherpad is " + etherpad);
    return;
  }
  if (message.search('[!:]sumo') === 0){
    client.say(to, "SUMO is short for http://support.mozilla.org, the official, community-powered support website for Mozilla Firefox");
    return;
  }
  if (message.search('[!:]qmo') === 0){
    client.say(to, "QMO is short for http://quality.mozilla.org, the official destination for everything related with Mozilla QA");
    return;
  }
});

client.addListener('pm', function(pmfrom, message){
  checkTestDay();
  if (testDayAdmins.indexOf(pmfrom) >= 0) {
    client.say(pmfrom, pmfrom + ' is a Test Day admin!');
    if (message.search(":admin") === 0){
      client.say(pmfrom, ':admin - print this list, :addAdmin <nickname>, :start <http://etherpad>, :stats, :stop');
    }
    if (message.search(":addAdmin") === 0){
      addTestDayAdmin = message.slice(message.indexOf(" ") + 1);
      testDayAdmins.push(addTestDayAdmin);
      client.say(pmfrom, 'set test day admins to ' + testDayAdmins.toString());
    }
    if (message.search(":stats") === 0){
      var stats = new Stats();
      stats.generateStats(metrics);
    }
    if (testDay){
      if (message.search(":stop") === 0){
        testDay = false;
        client.say(pmfrom, "testDay is now " + testDay.toString());
        var stats = new Stats();
        stats.generateStats(metrics);
        // TODO: other tidying up? reporting?
      }
    } else {
      if (message.search(":start") === 0){
        testDay = true;
        etherpad = message.slice(message.indexOf(" ") + 1);
        startTime = Date.now();
        // re-initialize stats-related variables?
        lastQuit = {};
        metrics = {
          greetedName: [],
          greetedNumber: 0,
          firebotBugs:[],
          usersTalked: {},
          hourUTC: {},
        };
        // TODO: other initialization?
        client.say(pmfrom, "testDay is now " + testDay.toString());
        client.say(pmfrom, "Today's etherpad is " + etherpad);
        client.say(pmfrom, "Today's test day admins are " + testDayAdmins);
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

Stats.prototype.generateStats = function(metrcs, callback){
  metrcs.testday = etherpad;

/* we no longer have access to this server 2014-12-14
    var options = {
    host: 'testdayserver.appspot.com',
    port: 80,
    path: '/bot',
    method: 'POST',
    headers: {
      'Content-length': JSON.stringify(metrcs).length,
    }
  };
  var req = http.request(options, function(res){
    console.log("REQUEST SENT TO APPENGINE");
    callback();
  });
  req.on('error', function(e){
    console.error(e);
  });

  req.write(JSON.stringify(metrcs));
  req.end();
*/

  var keys = Object.keys(metrcs);
  var what = Object.prototype.toString;
  for (var i = 0; i < keys.length; i++){
    if (what.call(metrcs[keys[i]]).search('Array') > 0){
      console.log(keys[i] + ":  " + metrcs[keys[i]].join(", "));
    } else {
      if (keys[i] == "usersTalked"){
        console.log("The following people were active in the channel: ");
        var speakers = Object.keys(metrcs.usersTalked);
        for (var t = 0; t < speakers.length; t++){
          console.log(speakers[t] + ": " + metrcs.usersTalked[speakers[t]]);
        }
      } else if (keys[i] == "hourUTC") {
        console.log("The following hours (UTC) were active in the channel: ");
        var speakers = Object.keys(metrcs.hourUTC);
        for (var t = 0; t < speakers.length; t++){
          console.log(speakers[t] + ": " + metrcs.hourUTC[speakers[t]]);
        }
      } else {
        console.log(keys[i] + ": " + metrcs[keys[i]]);
      }
    }
  }
};
