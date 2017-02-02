(ns app.core
  (:require-macros [reagent.ratom :refer [reaction]])
  (:require [clojure.string]
            [reagent.core :as reagent :refer [atom]]
            [re-frame.core :as rf]
            [goog.events :as events]
            [goog.history.EventType :as EventType]
            [secretary.core :as secretary]
            [bidi.bidi :as bidi]
            [app.firebase :as firebase]
            [app.format :as format]

            ;; websocket repl
            [weasel.repl :as repl]

            ;; browser repl
            [clojure.browser.repl :as brepl]

            [swipe-nav :as swipe-nav]
            )
  (:import goog.history.Html5History
           [goog.String]))

(enable-console-print!)
;; (println "Hello world!")

;; "native" cljs repl
;; (defonce conn (brepl/connect "http://localhost:9000/repl"))

;; weasel (websocket) cljs repl:
;; (when-not (repl/alive?) (repl/connect "ws://localhost:9001"))

;; Quick and dirty history configuration.

(def routes ["/" {"story" {["/" :id] :story}
                  "topstories" :topstories
                  "" :topstories}
             "" :topstories])

(defn get-initial-path []
  (.slice js/window.location.hash 1))

(defn setup-history []
  ;; goog history works via '#' hashes
  (let [h (Html5History.)]
    (goog.events/listen h EventType/NAVIGATE
                        (fn [ev]
                          (rf/dispatch [:route-path (.-token ev)])))
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

(rf/reg-fx
  :load-item-and-kids
  (fn load-item-and-kids-effect [item-id]
    (firebase/get-items-by-id
     [item-id]
     (fn [items]
       (rf/dispatch [:update-items items])
       (firebase/get-items-by-id (-> items first (get "kids")) :update-items)))))

(rf/reg-fx
 :set-swipe-direction-right
 (fn []

   ))

;; set the initial state: (submit [:initialize])
(rf/reg-event-db
 :initialize
 (fn
   [db _]
   (merge db initial-state)))

;; update the provided topstory-ids
(rf/reg-event-db
 :topstories
 (fn [db [_ value]]
   (assoc db :topstories value)))

;; update the provided items
(rf/reg-event-db
 :update-items
 (fn [db [_ items]]
   (update db :items into (map (fn [v] [(v "id") v]) items))))

;;; navigation

;; set the item that would be shown when moving down
(rf/reg-event-fx
 :navigation-set-next-item-id
 (fn [{:keys [db]} [_ item-id]]
   {:db (assoc-in db [:navigation :next-item-id] item-id)
    :load-item-and-kids item-id}))

;; navigate to the parent item
(rf/reg-event-db
 :navigation-up
 (fn [db [_]]
   (update-in db [:navigation :item-path] pop)))

;; navigate to the next-item-id
(rf/reg-event-db
 :navigation-down
 (fn [db _]
   (-> db
       (update-in [:navigation :item-path] conj (-> db :navigation :next-item-id))
       (assoc-in [:navigation :next-item-id] nil))))

(rf/reg-event-db
 :route-path
 (fn [db [_ value]]
   (assoc db :route-path value)))

(rf/reg-sub
 :topstories
 (fn
   [db _]
   (:topstories db)))

(rf/reg-sub
 :item
 (fn
   ([db [_ item-id]]
    ;; static subscription: item-id is a plain number
    (-> db :items (get item-id)))
   ([db _ [item-id]]
    ;; dynamic subscription: third param item-id is a (resolved) ratom
    (assert (= 1 (count _)))
    (-> db :items (get item-id)))))

(rf/reg-sub
 :navigation
 (fn [db [_ path-index]]
   (get db :navigation)))

(rf/reg-sub
 :navigation-item-path
 (fn [db [_ path-index]]
   (-> db :navigation :item-path (nth path-index nil))))

(rf/reg-sub
 :items
 (fn
   [db _]
   (:items db)))

(rf/reg-sub
 :route
 (fn [db _]
   (or (bidi/match-route routes (:route-path db)) "nooomatch")))

;; components

(defn spinner
  "A loading animation with a label."
  [label]
  [:div
   [:div.spinner [:div.bounce1] [:div.bounce2] [:div.bounce3]]
   [:div {:style {:text-align "center" :color "#888" :margin-top 10}}
    label]])

(defn story-item [story]
  (let [;; highlight (with transition) the currently selected/touched story
        nav (rf/subscribe [:navigation])]
    (fn [story]
      (let [story-id (get story "id")
            ;; TODO: ensure selected is only true if story-item is actually
            ;; visible to reduce redundant renderings
            selected? (condp = (-> @nav :item-path count)
                        0 (-> @nav :next-item-id (= story-id))
                        1 (-> @nav :item-path first (= story-id))
                        false)]
        (if (not story)
          [:div]
          ;; :a {:href (story "url")}
          [:div.story {:style {:display "flex"
                               :justify-content "space-between"
                               :align-items "baseline"
                               :padding "16px 10px"}
                       :class (if selected? (str "selected") (str "not-selected"))}
           [:a {:style {:flex "0 1 auto" :width "100%"}
                :href "/"}
            (story "title")]
           [:div {:style {:flex "5ex" :text-align "right"}}
            [:span (story "descendants")]]])))))

(defn story-list []
  (let [stories (rf/subscribe [:topstories])
        items (rf/subscribe [:items])]
    (fn []
      [:div.story-list
       (if (and (seq @stories) (every? #(seq (get @items %)) @stories))
         (doall (for [story-id @stories]
                  [:div {:key story-id :on-touch-start #(rf/dispatch [:navigation-set-next-item-id story-id])}
                   [story-item (get @items story-id)]]))
         [spinner "loading stories"])])))

(defn comment-list-item [item-id]
  (let [item (rf/subscribe [:item item-id])]
    (fn []
      [:div.comment {:data-item-id (if (get @item "kids") (get @item "id") "")
                     :on-touch-start #(rf/dispatch [:navigation-set-next-item-id item-id])}
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
  (let [item-id (rf/subscribe [:navigation-item-path path-index])
        ;; dynamic subscription
        ;; item (rf/subscribe [:item] [item-id])
        items (rf/subscribe [:items])
        kid-ids (reaction (-> @items (get @item-id) (get "kids")))
        items-loaded (reaction (every? #(seq (get @items %)) @kid-ids))]
    (fn []
      [:div
       (if @items-loaded
         (for [k-id @kid-ids]
           ^{:key k-id} [comment-list-item k-id])
         [spinner "loading comments"])])))

(defn swipe-nav-component
  "Wrap the native js swipe-nav component in reagent."
  []
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
                      :height "100%" :overflow-y "auto"}
        sw (atom nil)
        slide-index (atom 0)
        on-index-update (fn [index]
                          (let [old-index @slide-index]
                            (reset! slide-index index)
                            (if (< index old-index)
                              (rf/dispatch [:navigation-up])
                              (rf/dispatch [:navigation-down]))))
        navigation (rf/subscribe [:navigation])
        items (rf/subscribe [:items])
        next-item-has-kids? (reaction (-> @items (get (:next-item-id @navigation)) (get "kids") boolean))]
    (reagent/create-class
     {:display-name "swipe-nav-component"
      :component-did-mount (fn [this]
                             (let [options (clj->js {:container (reagent/dom-node this)
                                                     :onIndexUpdate on-index-update})]
                               (reset! sw (-> js/swipe-nav .-default (.create options)))))
      :component-will-unmount (fn []
                                (.kill @sw)
                                (reset! sw nil))
      :reagent-render (fn [children]
                        ;; container
                        [:div {:style container-styles}
                         ;; wrapper
                         [:div {:style wrapper-styles}
                          ;; children
                          (map-indexed
                           (fn [i c] [:div {:style child-styles
                                            :key i
                                            :onTouchStart #(.setIsContentAvailable @sw (clj->js {:right @next-item-has-kids? :left true}))}
                                      (if (coll? c)
                                        c
                                        [c])])
                            children)]])})))

(defn root-view
  []
  (let [;; nesting is fixed to 16 levels as with swipe.js you cannot dynamically add slides
        ;; TODO: use options.continuous or increase the limit arbitrarly :)
        comment-nesting-limit 16
        route (rf/subscribe [:route])]
    (fn []
      [:div {:style {;; enable vertical scrolling of individual slides
                     :position "absolute" :top 0 :bottom 0 :left 0 :right 0}}
       [swipe-nav-component
        (apply conj []
               story-list
               (map (fn [i] [comment-list i]) (range comment-nesting-limit)))]])))

;; TODO:
;; - research first-class components
;;   - anonymously: (create-component [story @story-id])
;;   - as values: (use-component component)

(defn load-topstories []
  (firebase/get-topstories 25 (fn [topstory-ids]
                                (rf/dispatch [:topstories topstory-ids])
                                (firebase/get-items-by-id topstory-ids :update-items))))

(defn on-js-load []
  (rf/clear-subscription-cache!)
  (swap! re-frame.db/app-db assoc-in [:navigation :item-path] [])
  (reagent/render [root-view] (.getElementById js/document "app-container")))

(defn ^:export run
  [root-element]
  (rf/dispatch-sync [:initialize])
  (load-topstories)
  (setup-history)
  (reagent/render [root-view] root-element))

(defonce initialized (atom false))

(defn main []
  (when-not @initialized
    (let [app-element (.getElementById js/document "app-container")]
      (reset! initialized true)
      (run app-element))))

(main)
