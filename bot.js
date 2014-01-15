// Requires
var irc = require('irc')
  , http = require('http');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {
      channels: ['#testday'],
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
    RUNNING_TIME = 1000 * 60 * 60 * 20;

client.addListener('join', function(channel, who){
  if (who !== nick){
    var lastMessageTime = Date.now() - lastQuit[who];

    if (lastQuit[who]){
      switch (true){
        case (lastMessageTime < 1800000):
          break;
        case (lastMessageTime < RUNNING_TIME):
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
});

client.addListener('message', function(from, to, message){
  if (message.search('[!:]bug') >= 0){
    client.say(to, "You can find details on how to raise a bug at https://developer.mozilla.org/en/Bug_writing_guidelines");
  }

  if (message.search('[!:]etherpad') >= 0){
    client.say(to, "Today's etherpad is " + etherpad);
  }
  if (message.search('[!:]sumo') >= 0){
    client.say(to, "SUMO is short for http://support.mozilla.org, the official, community-powered support website for Mozilla Firefox");
  }
  if (message.search('[!:]qmo') >= 0){
    client.say(to, "QMO is short for http://quality.mozilla.org, the official destination for everything related with Mozilla QA");
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
});

client.addListener('pm', function(nick, message){
  if (message.search('stats') === 0){
    var stats = new Stats();
    stats.generateStats(metrics);
  }
});

client.addListener('quit', function(who, reason, channel){
  lastQuit[who] = Date.now();
});

client.addListener('part', function(channel, who, reason){
  lastQuit[who] = Date.now();
});

client.addListener('error', function(message){
  console.error(message);
});

setTimeout(function(){
    var stats = new Stats();
    stats.generateStats(metrics, function() {
      process.exit();
    });
  }, RUNNING_TIME);

var Stats = function(){};

Stats.prototype.generateStats = function(metrcs, callback){
  metrcs.testday = etherpad;
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
        console.log("The following hours were active in the channel: ");
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
