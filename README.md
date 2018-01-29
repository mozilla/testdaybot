# Test Day Bot

This is an IRC bot that supports Mozilla QA Test Days.

## Installation

Run `npm install` to install the bot and dependencies.

## Configuration

Settings are provided via environment variables:

* IRC_HOST - host of IRC server to connect to
* IRC_PORT - port of IRC server to connect to
* IRC_NICKNAME - nickname to use on IRC
* IRC_PASSWORD - NickServ registered password
* IRC_CHANNELS - comma separated list of IRC channels to join
* IRC_SECURE - use a secure connection to IRC (default: true)
* IRC_AUTO_REJOIN - auto rejoin if disconnected from IRC (default: true)
* ADMINS - comma separated IRC nicks of default admins
* HELPERS - comma separated IRC nicks of default helpers
* AD_CHANNELS - comma separated IRC channels to advertise in
* AD_MESSAGE - message to use when advertising the test day

## Running

Run `node bot.js` to start the bot.

## Usage

Send ':help' via a direct message to the bot to receive a list of commands.
