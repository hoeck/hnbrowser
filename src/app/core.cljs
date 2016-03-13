(ns app.core
  (:require-macros [reagent.ratom :refer [reaction]])
  (:require [clojure.string]
            [reagent.core :as reagent :refer [atom]]
            [re-frame.core :refer [dispatch
                                   dispatch-sync
                                   register-handler
                                   register-sub
                                   subscribe]]
            [goog.events :as events]
            [goog.history.EventType :as EventType]
            [secretary.core :as secretary]
            [bidi.bidi :as bidi]
            [app.firebase :as firebase]
            [app.format :as format])
  (:import goog.History
           [goog.String]))

;; Quick and dirty history configuration.

(def routes ["/" {"story" {["/" :id] :story}
                  "topstories" :topstories
                  "" :topstories}
             "" :topstories])

(defn get-initial-path []
  (.slice js/window.location.hash 1))

(defn setup-history []
  ;; goog history works via '#' hashes
  (let [h (History.)]
    (goog.events/listen h EventType/NAVIGATE
                        (fn [ev]
                          (dispatch [:route-path (.-token ev)])))
    (.setEnabled h true)))

;; todo: use datascript!!
;; app db is at re-frame.db/app-db
(def initial-state
  {;; ui state
   :route-path (get-initial-path)

   :navigation {;; a list of item-ids that form the path to currently displayed item
                ;; the last element is always the `current` item-id
                ;; [] is the `root path` (topstory list)
                :item-path []
                ;; the next item (visible when swiping to the right)
                :next-item-id nil}

   ;; raw firebase data
   :topstories []
   :items {}})

;; set the initial state: (submit [:initialize])
(register-handler
 :initialize
 (fn
   [db _]
   (merge db initial-state)))

;; update the provided topstory-ids
(register-handler
 :topstories
 (fn [db [_ value]]
   (assoc db :topstories value)))

;; update the provided items
(register-handler
 :update-items
 (fn [db [_ items]]
   (update db :items into (map (fn [v] [(v "id") v]) items))))

;;; navigation

;; set the item that would be shown when moving down
(register-handler
 :navigation-set-next-item-id
 (fn [db [_ item-id]]
   (assoc-in db [:navigation :next-item-id] item-id)))

;; navigate to the parent item
(register-handler
 :navigation-up
 (fn [db [_]]
   (update-in db [:navigation :item-path] pop)))

;; navigate to the next-item-id
(register-handler
 :navigation-down
 (fn [db _]
   (-> db
       (update-in [:navigation :item-path] conj (-> db :navigation :next-item-id))
       (assoc-in [:navigation :next-item-id] nil))))

(register-handler
 :route-path
 (fn [db [_ value]]
   (assoc db :route-path value)))

(register-sub
 :topstories
 (fn
   [db _]
   (reaction (:topstories @db))))

(register-sub
 :item
 (fn
   ([db [_ item-id]]
    ;; static subscription: item-id is a plain number
    (reaction (-> @db :items (get item-id))))
   ([db _ [item-id]]
    ;; dynamic subscription: third param item-id is a (resolved) ratom
    (assert (= 1 (count _)))
    (reaction (-> @db :items (get item-id))))))

(register-sub
 :navigation-item-path
 (fn [db [_ path-index]]
   (reaction (-> @db :navigation :item-path (nth path-index nil)))))

(register-sub
 :items
 (fn
   [db _]
   (reaction (:items @db))))

(register-sub
 :route
 (fn [db _]
   (reaction (or (bidi/match-route routes (:route-path @db)) "nooomatch"))))

;; tools

(defn find-element-item-id
  "Return the data-item-id of element or one of its nearer parents."
  [element]
  (some #(.getAttribute % "data-item-id")
        (take-while identity (take 8 (iterate #(.-parentElement %) element)))))

(defn load-item-and-kids [item-id]
  "Load the item item-id and its kids."
  (firebase/get-items-by-id
   [item-id]
   (fn [items]
     (dispatch [:update-items items])
     (firebase/get-items-by-id (-> items first (get "kids")) :update-items))))

;; components

(defn spinner
  "A loading animation with a label."
  [label]
  [:div
   [:div.spinner [:div.bounce1] [:div.bounce2] [:div.bounce3]]
   [:div {:style {:text-align "center" :color "#888" :margin-top 10}}
    label]])

(defn story-item [story]
  (if (not story)
    [:div]
    ;; :a {:href (story "url")}
    [:div.story {:style {:display "flex"
                         :justify-content "space-between"
                         :align-items "baseline"
                         :margin "32px 10px"}
                 :data-item-id (story "id")}
     [:div {:style {:flex "0 1 auto" :width "100%"}}
      (story "title")]
     [:div {:style {:flex "5ex" :text-align "right"}}
      [:span (story "descendants")]]]))

(defn story-list []
  (let [stories (subscribe [:topstories])
        items (subscribe [:items])]
    [:div
     (if (seq @stories)
       (doall (for [story-id @stories]
                [:div {:key story-id}
                 [story-item (get @items story-id)]]))
       [spinner "loading stories"])]))

(defn comment-list-item [item-id]
  (let [item (subscribe [:item item-id])]
    (fn []
      [:div.comment {:data-item-id (if (get @item "kids") (get @item "id") "")}
       [:div.content {:dangerouslySetInnerHTML {:__html (get @item "text")}}]
       [:div.item
        (let [username (get @item "by")
              number-of-replies (count (get @item "kids"))
              replies (condp = number-of-replies
                        0 "no replies"
                        1 "1 reply"
                        (format/format "%s replies" number-of-replies))]
          (clojure.string/join ", " [username replies]))]])))

(defn comment-list
  "Render the given comments kids in a list."
  [path-index]
  (let [item-id (subscribe [:navigation-item-path path-index])
        ;; dynamic subscription
        ;; item (subscribe [:item] [item-id])
        items (subscribe [:items])
        kid-ids (reaction (-> @items (get @item-id) (get "kids")))
        items-loaded (reaction (every? #(seq (get @items %)) @kid-ids))]
    (fn [path-index]
      [:div
       (if @items-loaded
         (for [k-id @kid-ids]
           ^{:key k-id} [comment-list-item k-id])
         [spinner "loading comments"])])))

(defn swipe [children slide-change-callback]
  "Container component that uses Swipe.js to navigate between children."
  ;; be careful when using it with 2 slides and
  ;; continous-mode, it will create 2 additional slides
  ;; by cloning child 1 and 2 - not sure how react
  ;; reacts to this
  (let [container-styles {;; swipe-styles
                          :overflow "hidden" :visibility "hidden" :position "relative"
                          ;; enable vertical scrolling of individual slides
                          :height "100%"}
        wrapper-styles {;; swipe styles
                        :overflow "hidden" :position "relative"
                        ;; enable vertical scrolling of individual slides
                        :height "100%"}
        child-styles {;; swipe styles
                      :float "left" :width "100%" :position "relative" :transitionProperty "transform"
                      ;; enable vertical scrolling of individual slides
                      :height "100%" :overflow-y "scroll"}
        swipe-object (atom nil)
        current-index (atom nil)]
    (reagent/create-class
     {:display-name "swipe"
      :component-did-mount
      (fn [this]
        ;; see https://github.com/lyfeyaj/swipe#config-options
        (reset! swipe-object (js/Swipe (reagent/dom-node this)
                                       (clj->js {:continuous false
                                                 :callback (fn [index]
                                                             (if (< index @current-index)
                                                               ;; slide left
                                                               (dispatch [:navigation-up])
                                                               ;; slide right
                                                               (dispatch [:navigation-down]))
                                                             (reset! current-index index))
                                                 :startSlidingCallback (fn [slide-element]
                                                                         (let [item-id (not-empty (find-element-item-id slide-element))]
                                                                           (when item-id
                                                                             (dispatch [:navigation-set-next-item-id (js/parseInt item-id)])
                                                                             ;; load the item
                                                                             (load-item-and-kids item-id))
                                                                           (clj->js {:allowSlidingLeft true
                                                                                     :allowSlidingRight (boolean item-id)})))}))))
      :component-will-unmount (fn []
                                (.kill @swipe-object)
                                (reset! swipe-object nil))
      :reagent-render (fn [children]
                        ;; container
                        [:div {:style container-styles}
                         ;; wrapper
                         [:div {:style wrapper-styles}
                          ;; children
                          (map-indexed
                           (fn [i c] [:div {:style child-styles :key i}
                                      (if (coll? c)
                                        c
                                        [c])])
                            children)]])})))

(defn root-view
  []
  (let [;; nesting is fixed to 16 levels as with swipe.js you cannot dynamically add slides
        ;; TODO: use options.continuous or increase the limit arbitrarly :)
        comment-nesting-limit 16
        route (subscribe [:route])]
    (fn []
      [:div {:style {;; enable vertical scrolling of individual slides
                     :position "absolute" :top 0 :bottom 0 :left 0 :right 0 :overflow-y "scroll"}}
       [swipe (apply conj []
                     story-list
                     (map (fn [i] [comment-list i]) (range comment-nesting-limit)))]])))

;; TODO:
;; - research first-class components
;;   - anonymously: (create-component [story @story-id])
;;   - as values: (use-component component)

(defn load-topstories []
  (firebase/get-topstories 25 (fn [topstory-ids]
                                (dispatch [:topstories topstory-ids])
                                (firebase/get-items-by-id topstory-ids :update-items))))

(defn ^:export run
  [root-element]
  (dispatch-sync [:initialize])
  (load-topstories)
  (setup-history)
  (reagent/render [root-view] root-element))

(defn main []
  (let [app-element (.getElementById js/document "app")]
    (when (-> app-element .-children .-length (= 0))
      (run app-element))))
