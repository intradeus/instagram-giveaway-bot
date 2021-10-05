This bot scrapes instagram, looks for giveaway posts (or anything really, you decide what to look for) and then likes, comments and tags a friend.

This bot is for demo purpose only, DO NOT USE OK ?? you BAD human, trying to scam influencers, unbelieavable.

 ## Usage 
 ### 1) Install dependencies :
 `` npm install ``
 ### 2) Rename .env.example to .env and modify its values.
 - usernames : the username(s) of your account(s) without the @, separated by a comma with no whitespace.
 - passwords: the password of the usernames, in the same order, separated by a comma with no whitespace.
 - mainHashtag: the main hashtag you're looking for (ex: giveaway)
 - excludeWords: a list of words you want to exclude (From experience I recommand removing the current list, but you can add more)
 - friends: A list of your friends ids, separated by a comma with no whitespace. PLEASE ASK FOR THEIR CONSENT BEFORE, SANS OUI C'EST NON.
 - comments: A list of comments, a random one will be picked for each giveaway separated by double slash (//).
 
 ### 3) Launch : 
 `` npm run start`` 
 
 ### 4) Watch your DMs and WIN USELESS STUFF !!! 
 
 
 ## How it works 
 Instagram's api is opened to their developer's program only and it cant do everything. The bot uses puppetteer, a headless browser.
 It logs into instagram, looks into the cookies for the CR token, and then can access their graphql APi, which allows to search for hashtags, like, post, comment,
 subscribe etc. using [instagood](https://github.com/reidark/instagood). After a certain amount of time, the CR token expires, and the bot will fetch a new one.
 
 
