// Requires
var irc = require('irc');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {channels: ['#testday'],},
    client = new irc.Client(ircServer, nick, options);

client.addListener('join', function(channel, who){
  if (who !== nick){
    console.log("Greeted " + who);
    client.say(channel, "Welcome to the Test Day " + who + "! Details of the Test Day can be found at https://etherpad.mozilla.org/testday-111202-webapps");
  }
});
