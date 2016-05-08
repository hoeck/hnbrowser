(set-env!
  :source-paths   #{"src"}
  :resource-paths #{"html"}
  :dependencies
  '[[adzerk/boot-cljs            "1.7.170-3"       :scope "test"]
    [adzerk/boot-cljs-repl       "0.3.0"           :scope "test"]
    [adzerk/boot-reload          "0.4.2"           :scope "test"]
    [pandeiro/boot-http          "0.6.3"           :scope "test"]
    [crisptrutski/boot-cljs-test "0.1.0-SNAPSHOT"  :scope "test"]
    [com.cemerick/piggieback      "0.2.1"          :scope "test"]
    [weasel                       "0.7.0"          :scope "test"]
    [org.clojure/tools.nrepl      "0.2.12"         :scope "test"]
    [org.clojure/clojure         "1.7.0"]
    [org.clojure/clojurescript   "1.7.170"]
    [reagent                     "0.6.0-alpha"]
    [re-frame                    "0.7.0-alpha"]
    [secretary                   "1.2.3"]
    [bidi                        "1.25.0"]
    [prismatic/schema            "1.0.3"]
    [cljsjs/firebase            "2.1.2-1"]
    ;; TODO: create a cljsjs package
    ;;       https://github.com/cljsjs/packages/wiki/Creating-Packages
    ;;[cljsjs/swipe               "2.0.0"]
    ])

(require
 '[adzerk.boot-cljs      :refer [cljs]]
 '[adzerk.boot-cljs-repl :refer [cljs-repl start-repl]]
 '[adzerk.boot-reload    :refer [reload]]
 '[crisptrutski.boot-cljs-test  :refer [test-cljs]]
 '[pandeiro.boot-http    :refer [serve]])

(deftask cider "CIDER profile"
  []
  (require 'boot.repl)
  (swap! @(resolve 'boot.repl/*default-dependencies*)
         concat '[[org.clojure/tools.nrepl "0.2.12"]
                  [cider/cider-nrepl "0.11.0-SNAPSHOT"]
                  [refactor-nrepl "2.0.0-SNAPSHOT"]])
  (swap! @(resolve 'boot.repl/*default-middleware*)
         concat '[cider.nrepl/cider-middleware
                  refactor-nrepl.middleware/wrap-refactor])
  identity)

(deftask auto-test []
  (set-env! :source-paths #{"src" "test"})
  (comp (watch)
        (speak)
        (test-cljs)))

(deftask dev []
  (set-env! :source-paths #{"src"})
  (comp (serve :dir "target/")
        (watch)
        ;; (speak)
        (reload :on-jsload 'app.core/main)
        (cider)
        (cljs-repl)
        (cljs :source-map true :optimizations :none)
        (target :dir #{"target"})))

(deftask build []
  (set-env! :source-paths #{"src"})
  (comp (cljs :optimizations :advanced)))
