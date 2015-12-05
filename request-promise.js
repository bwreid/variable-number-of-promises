var Q              = require('q');
var cheerio        = require('cheerio');
var requestPromise = require('request-promise');

var url    = 'https://denver.craigslist.org/search/jjj?sort=date&query=web%20developer';
var host   = 'https://denver.craigslist.org';

function scrapeMainPage () {
  return requestPromise(url);
}

function filterUris (uris) {
  return uris.filter(function (uri) {
    return uri && uri.indexOf('//') == -1;
  });
}

function constructUrls (uris) {
  return uris.map(function (uri) {
    return host + uri;
  });
}

function mainPageUrls (html) {
  var $              = cheerio.load(html),
      listedPostings = $('a.hdrlnk');
  
  var uris = Object.keys(listedPostings).map(function (key) {
    var post = listedPostings[key];
    if (post.attribs && post.attribs.href) {
      return post.attribs.href;
    }
  });

  var selectedUris = filterUris(uris);
  var urls         = constructUrls(selectedUris);

  return urls;
}

function requestPromises (urls) {
  return urls.map(function (url) {
    return requestPromise(url).then(function (html) {
      return { url: url, html: html };
    });
  });
}

function buildJobList (jobRequest, ctx) {
  return jobRequest.then(function (response) {
    var $ = cheerio.load(response.html);
    var listing = {
      title: $('.postingtitletext').text(),
      description: $('.userbody').text(),
      url: response.url
    };

    ctx.push(listing);
    return ctx;
  });
}

Q.fcall(scrapeMainPage).
  then(function (html) {
    var urls = mainPageUrls(html); // ['http://..', 'http://..', ...]
    return requestPromises(urls); // [Promise(http://), Promise(http://) ..]
  }).
  then(function (promises) {
    var finalPromise = promises.reduce(function (qPromise, jobRequest) {
      return qPromise.then(function (ctx) {
        return buildJobList(jobRequest, ctx);
      });
    }, Q.resolve([]));

    return finalPromise;
  }).
  done(function (response) {
    console.log(response);
  });