'use strict';

var hnBrowser = angular.module('hnBrowser', ['hnBrowserServices', 'hnBrowserControllers', 'ngRoute', 'ngSanitize', 'ngTouch', 'ngAnimate']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []),
    hnBrowserServices = angular.module('hnBrowserServices', ['firebase']);

hnBrowser.config(['$routeProvider', function ($routeProvider) {
    $routeProvider
            .when('/stories', {
                template: function() {
                    return document.getElementById('StoryListTmpl').innerText;
                },
                controller: 'StoryListCtrl'
            })
            .when('/stories/:itemId', {
                template: function() {
                    return document.getElementById('StoryTmpl').innerText;
                },
                controller: 'StoryCtrl'
            })
            .otherwise({
                redirectTo: '/stories'
            });
}]);

/**
 * Service that deals with loading HN items (stories, comments).
 */
hnBrowserServices.factory('Items', ['$firebaseArray', '$firebaseObject', function ($firebaseArray, $firebaseObject) {
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
    service.loadKids = function (item, recur, allLoaded) {
        var kidsToLoad = item.kids && item.kids.length || 0;

        item.kids_full = _.map(item.kids, function (itemId) {
            var o = $firebaseObject(fireRef.child('item').child(itemId));

            o.$loaded().then(function(x) {
                kidsToLoad -= 1;
                if (!kidsToLoad && allLoaded) {
                    allLoaded.resolve();
                }

                if (recur) {
                    service.loadKids(x, (typeof recur === 'number') ? recur-1 : recur);
                }
            });

            return o;
        });
    };

    /**
     * Return an item with all kids loaded.
     *
     * recur is apassed to .loadKids to control how many levels of
     * kids to load.
     */
    service.loadFullItem = function (itemId, recur, allLoaded) {
        var item = service.loadItem(itemId);
        item.$loaded().then(function () { service.loadKids(item, recur, allLoaded); });
        return item;
    };

    return service;
}]);

hnBrowserServices.factory('ScrollTo', ['$window', '$interval', function ($window, $interval) {
    var service = {};

    service.scrollTo = function (elementId) {
        var el = $window.document.getElementById(elementId);

        if (el) {
            el.scrollIntoView();
        } else {
            $interval(function() {
                var el = $window.document.getElementById(elementId);
                if (el) {
                    el.scrollIntoView();
                }
            }, 0, 1);
        }
    };

    return service;
}]);

/**
 * Service that takes care of comment navigation details.
 *
 * Set the appropriate URL and the viewAnimationClass on the
 * rootScope to control the direction of the swipe animation.
 */
hnBrowserServices.factory('ItemNavigation', ['$route', '$rootScope', '$animate', function ($route, $rootScope, $animate) {
    var service = {};

    service.down = function (itemId) {
        $rootScope.viewAnimationClass = 'down';
        $route.updateParams({itemId:itemId});
    };

    service.up = function (itemId, activeItem) {
        $rootScope.viewAnimationClass = 'up';
        $route.updateParams({itemId:itemId, activeItem:activeItem});
    };

    service.cantGoDown = function () {
        // cheat; TODO: create an animated-view directive!
        var el = document.querySelector('.view-frame');
        $animate.addClass(el, 'wiggle').done(function () {
            $animate.removeClass(el, 'wiggle');
        });
    };

    return service;
}]);

hnBrowserControllers.controller('StoryListCtrl', ['$scope', 'Items', function ($scope, items) {
    $scope.stories = [];

    items.getTopStories().then(function (stories) {
        $scope.stories = stories;
    });
}]);

hnBrowserControllers.controller('StoryCtrl', ['$q', '$scope', '$routeParams', 'ItemNavigation', 'Items', 'ScrollTo', function ($q, $scope, $routeParams, ItemNavigation, items, ScrollTo) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url),
        afterLoad = $q.defer();

    afterLoad.promise.then(function() {
        if ($routeParams.activeItem) {
            // TODO: keep the correct item offset from the top too?
            ScrollTo.scrollTo($routeParams.activeItem);
        }
    });

    // load item and its children
    $scope.story = items.loadFullItem($routeParams.itemId, 0, afterLoad);

    // navigation
    $scope.down = function (item) {
        if (!(item.kids && item.kids.length)) {
            ItemNavigation.cantGoDown();
        } else {
            ItemNavigation.down(item.id);
        }
    };

    $scope.up = function () {
        ItemNavigation.up($scope.story.parent, $scope.story.id);
    };
}]);
