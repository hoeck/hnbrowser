'use strict';

var hnBrowser = angular.module('hnBrowser', ['firebase', 'hnBrowserControllers']),
    hnBrowserControllers = angular.module('hnBrowserControllers', []);

hnBrowserControllers.controller('StoryListCtrl', ['$scope', '$firebaseArray', '$firebaseObject', function ($scope, $firebaseArray, $firebaseObject) {
    var url = 'https://hacker-news.firebaseio.com/v0',
        fireRef = new Firebase(url),
        testStoryId = 9918365;

    // https://hacker-news.firebaseio.com/v0/topstories.json
    // https://hacker-news.firebaseio.com/v0/item/XXXX.json
    $scope.stories = [];
    $scope.topstoryIds = $firebaseArray(fireRef.child('topstories'));
    $scope.topstoryIds.$loaded().then(function () {
        _.map(_.take($scope.topstoryIds, 5), function(x,i) {
            $scope.stories[i] = $firebaseObject(fireRef.child('item').child(x.$value));
        })
    });
}]);
