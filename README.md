A [Hacker News](https://news.ycombinator.com) comment browser optimized for touch navigation and smaller screens.

[Try It](https://hoeck.github.io/hnbrowser)

Built with [re-frame](https://github.com/Day8/re-frame). Uses ~~the [Boot](http://boot-clj.com/)~~ my own [cljsbuild](github.com/hoeck/cljsbuild) build tool.

## developing

    # install js dependencies
    $ npm install

    # start an nrepl server
    $ npm run nrepl

    # connect to it and run (start-repl) to launch the figwheel repl + watcher,
    # open localhost:8080/build to launch hnbrowser
