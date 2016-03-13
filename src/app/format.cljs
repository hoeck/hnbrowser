(ns app.format
  (:require [goog.string :as gstring]
            [goog.string.format]))

(defn format
  "Formats a string using goog.string.format."
  [fmt & args]
  (apply gstring/format fmt args))
