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

hnBrowserServices.factory('Items', ['$q', '$firebaseArray', '$firebaseObject', function ($q, $firebaseArray, $firebaseObject) {
    var service = {},
        url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    // https://hacker-news.firebaseio.com/v0/topstories.json
    // https://hacker-news.firebaseio.com/v0/item/XXXX.json
    service.getTopStories = function () {
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
    service.loadItem = function (itemId) {
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
    service.loadKids = function (item, recur) {
        item.kids_full = _.map(item.kids, function (itemId) {
            var o = $firebaseObject(fireRef.child('item').child(itemId));
            if (recur) {
                o.$loaded().then(function(x) {
                    service.loadKids(x, (typeof recur === 'number') ? recur-1 : recur);
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
    service.loadFullItem = function (itemId, recur) {
        var item = service.loadItem(itemId);
        item.$loaded().then(function () { service.loadKids(item, recur); });
        return item;
    };

    return service;
}]);

hnBrowserControllers.controller('StoryListCtrl', ['$scope', 'Items', function ($scope, items) {
    $scope.stories = [];

    items.getTopStories().then(function (stories) {
        $scope.stories = stories;
    });
}]);

hnBrowserControllers.controller('StoryCtrl', ['$scope', '$routeParams', 'Items', function ($scope, $routeParams, items) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    $scope.story = items.loadFullItem($routeParams.itemId, 2);
}]);
