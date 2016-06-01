# Offline Spell Checker

>**Notice:** This extension is in an alpha state and is still under heavy development. Pull requests welcome!  

## Description 

This extension is a spell checker that uses a local dictionary for offline usage. [hunspell-spellchecker](https://github.com/GitbookIO/hunspell-spellchecker) is used to load hunspell formatted dictionaries. Errors are be highlighted, and hovering over them will show possible suggestions. The `suggest` function was modified according to [https://github.com/GitbookIO/hunspell-spellchecker/pull/7] to speed up word suggestions.

Since this extension is not currently released, you can load it in the extension debugger by following [these](https://code.visualstudio.com/docs/extensions/example-hello-world#_running-your-extension) instructions. 

## Benchmarks (sort of)

A 397-line document was used to test the functionality. This was a conference paper that I recently wrote using Pandoc (citeproc and crossref). Simple space separation results in 5134 words. Here are some of the processing times as functionality was added. These were measured using `new Date().getTime()` so results were not consistent.  

* Initial test: 1.577 Minutes
* Added suggestion dictionary for suggestions that have already been processed: 1.0507 minutes
* Removed YAML settings at the beginning of the document (Pandoc settings): 0.841 minutes
* Removed inline citations: 0.50695 minutes
* Removed inline image links: 0.2913 minutes
* Words of length >= 4: 13.931 seconds

## Known Issues

* Only U.S. English supported at the moment
* Entire file is rechecked with each update
* Settings are not configurable

## Acknowledgements

Based heavily on the Sean McBreen's [Spell and Grammer Check](https://github.com/Microsoft/vscode-spell-check).

## License

MIT
