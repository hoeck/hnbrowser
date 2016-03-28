#!/bin/sh

if [ `git status --porcelain` ] ; then
    echo "ERROR: unstaged changes"
    exit 1
fi

echo "# compiling clojurescript for production"
boot build

echo "# preparing gh-pages branch"
cp html/index.html . && git add index.html
cp -r html/js .      && git add js/*
cp target/main.js .  && git add main.js

echo "# creating (temporary) commit for gh-pages"
git rm -r html src test boot.properties build.boot publish.sh
git commit -m "publish $(git rev-parse HEAD) to gh-pages"

echo "# pushing to gh-pages"
git push origin --delete gh-pages
git push origin HEAD:gh-pages

echo "# reverting temporary commit"
git reset --hard HEAD~1

echo "# cleaning"
git clean -f *

echo "# done"
