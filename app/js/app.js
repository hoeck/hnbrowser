'use strict';

var hnBrowser = angular.module('hnBrowser', ['hnBrowserServices', 'hnBrowserControllers', 'ngRoute', 'ngSanitize']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []),
    hnBrowserServices = angular.module('hnBrowserServices', ['firebase']);

hnBrowser.config(['$routeProvider', function ($routeProvider) {
    $routeProvider
            .when('/stories', {
                template: function() {
                    return document.getElementById('StoryListTmpl').innerText;
                },
                controller: 'StoryListCtrl',
            })
            .when('/stories/:itemId', {
                template: function() {
                    return document.getElementById('StoryTmpl').innerText;
                },
                controller: 'StoryCtrl',
            })
            .otherwise({
                redirectTo: '/stories'
            });
}]);

hnBrowserServices.factory('Stories', ['$q', '$firebaseArray', '$firebaseObject', function ($q, $firebaseArray, $firebaseObject) {
    var storyService = {},
        url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    // https://hacker-news.firebaseio.com/v0/topstories.json
    // https://hacker-news.firebaseio.com/v0/item/XXXX.json
    storyService.getTopStories = function () {
        var topstoryIds = $firebaseArray(fireRef.child('topstories'));

        return topstoryIds.$loaded().then(function () {
            return _.map(_.take(topstoryIds, 5), function (x) {
                return $firebaseObject(fireRef.child('item').child(x.$value));
            });
        });
    };

    /**
     * Load an item (story, comment) an return it.
     */
    storyService.loadItem = function (itemId) {
        return $firebaseObject(fireRef.child('item').child(itemId));
    };

    /**
     * Load all kids of an item (story, comment).
     *
     * Place them in the 'kids_full' attribute.
     * Set recur to true to load the kids kids as well.
     * Set recur to a positive integer to only load the given amount
     * of levels.
     */
    storyService.loadKids = function (story, recur) {
        story.kids_full = _.map(story.kids, function (itemId) {
            var o = $firebaseObject(fireRef.child('item').child(itemId));
            if (recur) {
                o.$loaded().then(function(x) {
                    storyService.loadKids(x, (typeof recur === 'number') ? recur-1 : recur);
                });
            }
            return o;
        });
    };

    /**
     * Return an item with all kids loaded.
     *
     * recur is apassed to .loadKids to control how many levels of
     * kids to load.
     */
    storyService.getFullStory = function (itemId, recur) {
        var story = storyService.loadItem(itemId);
        story.$loaded().then(function () { storyService.loadKids(story, recur); });
        return story;
    };

    return storyService;
}]);

hnBrowserControllers.controller('StoryListCtrl', ['$scope', 'Stories', function ($scope, Stories) {
    $scope.stories = [];

    Stories.getTopStories().then(function (stories) {
        $scope.stories = stories;
    });
}]);

hnBrowserControllers.controller('StoryCtrl', ['$scope', '$routeParams', 'Stories', function ($scope, $routeParams, storyService) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    $scope.story = storyService.getFullStory($routeParams.itemId, 2);
}]);
