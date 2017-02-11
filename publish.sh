#!/bin/sh

# Publish the tip of the current branch to origin/gh-pages.
#
# Usage: ./publish.sh
#
# This repository must be free of unstaged changes or untracked files for this
# script to work.

if [ `git status --porcelain` ] ; then
    echo "ERROR: unstaged changes"
    exit 1
fi

echo "# compiling clojurescript for production"
npm run build-production

echo "# preparing gh-pages branch"
cp html/index.html . && git add index.html
mkdir js && cp build/js/main.js js/main.js && git add js/main.js

echo "# creating (temporary) commit for gh-pages"
git commit -m "publish $(git rev-parse HEAD) to gh-pages"

echo "# pushing to gh-pages"
git push origin --delete gh-pages
git push origin HEAD:gh-pages

echo "# reverting temporary commit"
git reset --hard HEAD~1

echo "# cleaning"
git clean -f *

echo "# done"
