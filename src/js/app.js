'use strict';

var hnBrowser = angular.module('hnBrowser', ['hnBrowserServices', 'hnBrowserControllers', 'hnBrowserDirectives', 'ngRoute', 'ngSanitize', 'ngTouch', 'ngAnimate']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []),
    hnBrowserServices = angular.module('hnBrowserServices', ['firebase']),
    hnBrowserDirectives = angular.module('hnBrowserDirectives', []);

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
 * Set the appropriate URL and control the animations (slide
 * left/right/bounce) on the element with the viewAnimation directive.
 */
hnBrowserServices.factory('ItemNavigation', ['$route', '$animate', function ($route, $animate) {
    var service = {},
        viewAnimation;

    service.registerViewAnimation = function (v) {
        viewAnimation = v;
    };

    service.down = function (itemId) {
        viewAnimation.setAnimationClass('down');
        $route.updateParams({itemId:itemId});
    };

    service.up = function (itemId, activeItem) {
        viewAnimation.setAnimationClass('up');
        $route.updateParams({itemId:itemId, activeItem:activeItem});
    };

    service.cantGoDown = function () {
        viewAnimation.toggleAnimationClass('bounce');
    };

    return service;
}]);

/**
 * Directive to control animation CSS classes on a toplevel element
 *
 * Wired to the ItemNavigation Service, should ony be used once within the
 * app.
 */
hnBrowserDirectives.directive('animateView', ['$animate', '$timeout', 'ItemNavigation', function ($animate, $timeout, ItemNavigation) {
    return {
        restrict: 'A',
        link: function link(scope, element, attrs) {
            var lastClassname = '';

            ItemNavigation.registerViewAnimation({
                setAnimationClass: function (classname) {
                    $animate.setClass(element, classname, lastClassname);
                    lastClassname = classname;
                },
                toggleAnimationClass: function (classname) {
                    $animate.addClass(element, classname).then(function () {
                        // :( does not work without timout altough .done
                        // should only fire when the animation is over :(
                        $timeout(function () {
                            element.removeClass(classname);
                        }, 250);
                    });
                }
            });
        }
    };
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

    // TODO: path
    // - remember and display the current path to the item so the user can
    //   easier follow conversations
    // - must be loaded when it does not exists
    // - should otherwise be computed when going down or going up

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
