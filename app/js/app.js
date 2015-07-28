'use strict';

var hnBrowser = angular.module('hnBrowser', ['firebase', 'hnBrowserControllers', 'ngRoute', 'ngSanitize']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []);

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

hnBrowserControllers.controller('StoryListCtrl', ['$scope', '$firebaseArray', '$firebaseObject', function ($scope, $firebaseArray, $firebaseObject) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url),
        testStoryId = 9918365;

    // https://hacker-news.firebaseio.com/v0/topstories.json
    // https://hacker-news.firebaseio.com/v0/item/XXXX.json
    $scope.stories = [];
    $scope.topstoryIds = $firebaseArray(fireRef.child('topstories'));
    $scope.topstoryIds.$loaded().then(function () {
        $scope.stories = _.map(_.take($scope.topstoryIds, 5), function (x) {
            return $firebaseObject(fireRef.child('item').child(x.$value));
        })
    });
}]);

hnBrowserControllers.controller('StoryCtrl', ['$scope', '$firebaseArray', '$firebaseObject', '$routeParams', function ($scope, $firebaseArray, $firebaseObject, $routeParams) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url);

    $scope.story = $firebaseObject(fireRef.child('item').child($routeParams.itemId));

    $scope.kids = [];
    $scope.story.$loaded().then(function () {
        $scope.kids = _.map($scope.story.kids, function(x) {
            return $firebaseObject(fireRef.child('item').child(x));
        });
    })
}]);
