// Requires
var irc = require('irc');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {channels: ['#testday'],autoRejoin: true,},
    client = new irc.Client(ircServer, nick, options),
    lastQuit = {};

client.addListener('join', function(channel, who){
  if (who !== nick){
    var lastMessageTime = Date.now() - lastQuit[who];
    
    if (lastQuit[who] && lastMessageTime < 1800000){
      
    } else {
      console.log("Greeted " + who);
      client.say(channel, "Welcome to the Test Day " + who + "! Details of the Test Day can be found at https://etherpad.mozilla.org/testday-111202-webapps");
    }
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
