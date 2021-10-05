const instagood = require("instagood");
const puppeteer = require("puppeteer");
const axios = require("axios");
require("dotenv").config();
const axiosRetry = require('axios-retry');

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  var localStorage = new LocalStorage('./localStorage');
}

const usernames = process.env.usernames.split(",");
const passwords = process.env.passwords.split(",");

const mainHashtag = process.env.mainHashtag;
const excludeWords = process.env.excludeWords.split(",");

const friends = process.env.friends.split(",");
const commentsList = process.env.comments.split("//");
axiosRetry(axios, { 
  retries: 5,
  retryCondition: e => { return axiosRetry.isNetworkOrIdempotentRequestError(e) || e.response.status === 429 }, 
  retryDelay: axiosRetry.exponentialDelay 
});

const userAgent = "Mozilla/5.0 (Linux; Android 8.1.0; motorola one Build/OPKS28.63-18-3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.80 Mobile Safari/537.36 Instagram 72.0.0.21.98 Android (27/8.1.0; 320dpi; 720x1362; motorola; motorola one; deen_sprout; qcom; pt_BR; 132081645)";

var sessionIds = [];
var csrfTokens = [];
var users = [];

var query_hash_giveaway = "";
var giveaways = [];
var end_cursor = "";

main();

async function main() {
  initializeUsersArray();

  await createUsers();
  await getQueryHash();

  for (var i = 0; i <= 0; i++) {
    await new Promise((r) => setTimeout(r, randomIntFromInterval(4000, 8000)));
    console.log("getting giveaways page " + i);

    giveaways = await getGiveaways(i);
    console.log(giveaways);
    if (!giveaways.length == 0) {
      try {
        await loopGiveaways();
      }
      catch(err){
        console.log("GENERAL ERROR : ", err);
      } 
    }
  }
}

async function loopGiveaways() {
  console.log("found " + giveaways.length + " giveaways. Filtering . . .");
  
  for (var i = 0; i < giveaways.length; i++) {

    var giveawayOwnerUsername = await getOwnerUsername(giveaways[i].ownerId);

    var giveawayShortcode = giveaways[i].shortcode;
    var uniqueMatches = getUniqueFollowMatch(giveaways[i].description, giveawayOwnerUsername)

    console.log("GIVEAWAY # " + i +" url : https://www.instagram.com/p/" + giveawayShortcode + "/");

    //get mediaId from media shortcode
    var media_id = await getMediaId(giveawayShortcode);

    //Enter the giveaway
    await usersActions(media_id, uniqueMatches);

    //Giveaway Done... wait and restart
    console.log(giveawayShortcode + " DONE");
    var waitingTime = randomIntFromInterval(180000, 300000);
    console.log("-\r\n-\r\n-");
    console.log("waiting " + millisToMinutesAndSeconds(waitingTime));
    await new Promise((r) => setTimeout(r, waitingTime));
  } 
}



async function usersActions(mediaId, matches) {
  var allComments = getRandomComments();
  var splice = 0;
  var amnt = allComments.length/usernames.length;

  for(var i = 0 ; i < usernames.length; i++){
    var localComments = allComments.slice(splice, splice + amnt);
    splice+=amnt;

    console.log("-----" + usernames[i]);
    console.log("-----Liking picture :");
    await userLikes(mediaId, i);
  
    console.log("-----Commenting picture :");
    await loopComments(mediaId, localComments, i);
  
    if (matches != null && matches.length > 0) {
      //clear duplicates in matches
      console.log("-----Following Accounts " + matches.toString());
      await loopFollows(matches, i);
    } 
  }
}

async function userLikes(mediaId, j) {
  await users[j].likes("like", mediaId).then(
     (response) => {
      if (response.status == "ok") {
        console.log("-----------Picture liked successfully");
      }
    },
    async (err) => {
      catchErrors(err);
      await createUser(j);
    }
  );
}

async function loopComments(mediaId, untaggedComments, j) {
  var comments = getCommentsWithTags(usernames[j], untaggedComments);

  for (var i = 0; i < comments.length; i++) {
    var comment = comments[i];

    await users[j].comments(mediaId, comment).then(
      (response) => {
        if (response.status == "ok") {
          console.log("-----------Comment added : '" + comment + " ' successfully");
        }
        if (response.status == "fail") {
          console.log("-----------Fail to add comment : ' " + comment + " '" );
        }
      },
      async (err) => {
        catchErrors(err);
        await createUser(j);
      }
    );

    await new Promise((r) =>
      setTimeout(r, randomIntFromInterval(10000, 20000))
    );
  }
}

async function loopFollows(matches, j) {
  for (var i = 0; i < matches.length; i++) {
    var match = matches[i];

    await users[j].friendships("follow", match).then(
      (response) => {
        if (response.status == "ok") {
          console.log("-----------Followed : " + match + " successfully");
        } 
        if(response.status == 'fail'){
          console.log('-----------Failed to follow '+ match);
        }
      },
      async (err) => {
        catchErrors(err);
        await createUser(j);
      }
    );

    await new Promise((r) =>
      setTimeout(r, randomIntFromInterval(10000, 20000))
    );
  }
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}


async function createUsers(){
  
  var lastTokensDate = Date.parse(localStorage.getItem('tokenExpirationDate'));
  var diff = Math.abs(new Date() - lastTokensDate);
  var minutes = Math.floor((diff/1000)/60);

  if(minutes < 180){
    createUsersFromOldTokens();
  }else {
    for(var i = 0 ; i < usernames.length ; i++){
      await createUser(i);
    }
  }  
  console.log("All users created");
  localStorage.setItem('tokenExpirationDate',new Date());
}


async function createUser(i){
    var browser = await puppeteer.launch({ headless: true, args: ['--incognito',]});
    var page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (!request.isNavigationRequest()) {
        request.continue();
        return;
      }
     
      var headers = request.headers();
      headers['accept-language'] = "en-US";
      request.continue({ headers });
    });

    process.on("unhandledRejection", (reason, p) => {
      console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
      browser.close();
    });

    await new Promise((r) =>
      setTimeout(r, 1000)
    );
    await page.goto("https://www.instagram.com/accounts/login/");
    await page.waitForSelector('input[name="username"]');
    await page.type('input[name="username"]', usernames[i]);
    await page.type('input[name="password"]', passwords[i]);
    await page.click('button[type="submit"]', { waitUntil: "networkidle0" });
  
    await page.waitForNavigation({ waitUntil: "networkidle0" })
  
    var data = await page._client.send("Network.getAllCookies");
    await browser.close();
  
    setCookies(data.cookies, i);
    users[i] = new instagood(usernames[i], csrfTokens[i], sessionIds[i]);
    localStorage.setItem('sessionId' + i , sessionIds[i]);
    localStorage.setItem('csrftoken' + i , csrfTokens[i]);

    console.log("!SESSION " + i + " CREATED !");
}

function createUsersFromOldTokens(){

  for(var i = 0 ; i < usernames.length ; i++){
    sessionIds[i] = localStorage.getItem('sessionId' + i);
    csrfTokens[i] = localStorage.getItem('csrftoken' + i);

    users[i] = new instagood(usernames[i], csrfTokens[i], sessionIds[i]);

    console.log("sessionid = " + i + " = " + sessionIds[i]);
    console.log("csrftoken " + i + " = " + csrfTokens[i]);
  }

}

async function getQueryHash() {
  var js_file = null;
  await axios
    .get(
      "https://www.instagram.com/static/bundles/base/TagPageContainer.js/f1172b0dfea6.js"
    )
    .then((response) => {
      js_file = response.data;
    });

  var js_file_string = js_file.toString();

  var regex = /byTagName.get\(t\).pagination},queryId:"([a-zA-Z0-9_]{32})"/gim;
  var regex2 = /([a-zA-Z0-9_]{32})/gim;

  var match_string = js_file_string.match(regex);
  var match_query_hash = match_string[0].match(regex2);

  query_hash_giveaway = match_query_hash[0];

  console.log("query_hash = " + query_hash_giveaway);
}

async function getGiveaways(index) {
  var url =
    index == 0
      ? "https://www.instagram.com/explore/tags/" + mainHashtag + "/?__a=1"
      : "https://www.instagram.com/graphql/query/?query_hash=" +
       query_hash_giveaway +'&variables={"tag_name":"' + mainHashtag +'","first":15,"after":"' + end_cursor +'"}';

  var dataset = ""; 
  await axios.get(url)
    .catch((error)=> catchErrors(error))
    .then((response) => dataset = response.data);

  var finalArray = filterResponse(dataset, index);

  return finalArray;
}

function filterResponse(data, index) {
  var arr1 = [];
  var arr2 = [];

  if (index == 0) {
    end_cursor = data.graphql.hashtag.edge_hashtag_to_media.page_info.end_cursor;
    arr1 = data.graphql.hashtag.edge_hashtag_to_media.edges;
    arr2 = data.graphql.hashtag.edge_hashtag_to_top_posts.edges;
  } else {
    end_cursor = data.data.hashtag.edge_hashtag_to_media.page_info.end_cursor;
    arr1 = data.data.hashtag.edge_hashtag_to_media.edges;
    arr2 = data.data.hashtag.edge_hashtag_to_top_posts.edges;
  }

  var arr3 = arr1.concat(arr2);
  var arrFinal = mapArray(arr3);

  return arrFinal;
}

function mapArray(array) {
  var newArray = [];


  for (var i = 0; i < array.length; i++) {
    var localDescription = " ";
    var likeCount = 0;
    var timestamp = 0;
    var commentCount = 0;

    if(array[i].node.edge_media_to_caption.edges.length > 0)
      localDescription = array[i].node.edge_media_to_caption.edges[0].node.text.toLowerCase();

    if(array[i].node.edge_media_preview_like)
      likeCount = array[i].node.edge_media_preview_like.count;

    if(array[i].node.edge_media_to_comment)
      commentCount = array[i].node.edge_media_to_comment.count;

    if(array[i].node.taken_at_timestamp)
      timestamp = array[i].node.taken_at_timestamp

    var filter1 = true;
    var filter2 = true;
    var filter3 = true;

    filter1 = localDescription.includes(" comment") || localDescription.includes(" tag ");

    if (excludeWords.length > 0)
      filter2 = !excludeWords.some((word) => localDescription.indexOf(word) >= 0);

    filter3 = checkPostLegitimacy(timestamp, likeCount, commentCount);

    if (filter1 && filter2 && filter3) {
      newArray.push({
        description: localDescription,
        shortcode: array[i].node.shortcode,
        ownerId: array[i].node.owner.id,
      });
    }
  }

  return newArray;
}

function setCookies(cookies, i) {
  cookies.forEach((cookie) => {
    if (cookie.name == "csrftoken") {
      csrfTokens[i] = cookie.value;
      localStorage.setItem('csrftoken' + i , csrfTokens[i]);
      console.log("csrftoken " + i + " = " + csrfTokens[i]);
    }

    if (cookie.name == "sessionid") {
      sessionIds[i] = cookie.value;
      localStorage.setItem('sessionId' + i , sessionIds[i]);
      console.log("sessionid = " + i + " = " + sessionIds[i]);
    }
  });
}

function getRandomComments() {
  for (var comments = [], i = 0; i < commentsList.length; ++i)
    comments[i] = commentsList[i];

  comments = shuffle(comments);
  var commentAmount = usernames.length*(usernames.length-1) + usernames.length * friends.length;

  comments.splice(commentAmount - 1, commentsList.length - commentAmount);

  return comments;
}

function shuffle(array) {
  var tmp,
    current,
    top = array.length;
  if (top)
    while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }
  return array;
}


function catchErrors(error){
    if (error.response) {
      console.log("ERROR RESPONSE")
        console.log(error.response.status);
        console.log(error.response.headers);
    } else if (error.request) {
      console.log("ERROR REQUEST")
        console.log(error.request);
    } else {
        console.log('ERROR MESSAGE')
        console.log( error.message);
    }
    console.log(error.config);
}

function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + "min" + (seconds < 10 ? '0' : '') + seconds;
}

function getUniqueFollowMatch(description, giveawayOwnerUsername){

  var regex = /@([A-Za-z0-9._](?:(?:[A-Za-z0-9._]|(?:\.(?!\.))){2,28}(?:[A-Za-z0-9._]))?)/gim;
  var matches = description.match(regex);

  if(matches != null){
    matches.push(giveawayOwnerUsername);
    return [...new Set(matches)];
  }
  else {
    return [giveawayOwnerUsername];
  }
}

function initializeUsersArray(){
  for (var i = 0; i < usernames.length; i++)
    users.push(new instagood());
}

function checkPostLegitimacy(timestamp, likeCount, commentCount){
  var actualTime = new Date();
  var actualTimeStamp = actualTime.getTime();
  actualTimeStamp/=1000;
  var diffTime = (actualTimeStamp/1000) - timestamp;
  
  if(diffTime < 10*60 && (likeCount < 2)){
    return false;
  }
  else if(diffTime < 15*60 && (likeCount < 3 && commentCount < 1)){
    return false;
  }
  else if(diffTime < 2*60*60 && (likeCount < 10 && commentCount < 5)){
    return false;
  }
  else if(diffTime > 2*60*60 && likeCount <15 && commentCount < 5){
    return false;
  }
  else {
    return true;
  }
}

async function getOwnerUsername(ownerId){
  var url = "https://i.instagram.com/api/v1/users/" + ownerId + "/info/";
  var dataset1 = "";

   await axios.get(url, { headers: {'User-Agent' : userAgent}})
     .catch((error)=> catchErrors(error))
     .then((response)=> dataset1 = response.data);

  return dataset1.user.username;
}


function getCommentsWithTags(username, untaggedComments){
  var tags = usernames.concat(friends);
  var index = tags.indexOf(username);
  if(index > -1) {
    tags.splice(index, 1);
  }

  for(var i = 0; i < untaggedComments.length; i++){
    untaggedComments[i]+= " @" + tags[i];
  }

  return untaggedComments;
}

async function getMediaId(shortcode) {
  var html_file = null;
  await axios
    .get("https://www.instagram.com/p/" + shortcode + "/")
    .then((response) => {
      html_file = response.data;
    });

  var html_file_string = html_file.toString();

  var regex = /instagram\:\/\/media\?id=([a-zA-Z0-9_]{19})/gim;
  var regex2 = /([a-zA-Z0-9_]{19})/gim;

  var match_string = html_file_string.match(regex);
  var match_media_id = match_string[0].match(regex2);

  var media_id = match_media_id[0];

  console.log("media_id = " + media_id);
  return media_id;
}