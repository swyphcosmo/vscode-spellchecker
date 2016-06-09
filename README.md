# Offline Spell Checker

[![Current Version](http://vsmarketplacebadge.apphb.com/version/swyphcosmo.spellchecker.svg)](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker)
[![Install Count](http://vsmarketplacebadge.apphb.com/installs/swyphcosmo.spellchecker.svg)](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker)

## Description 

This extension is a spell checker that uses a local dictionary for offline usage. [hunspell-spellchecker](https://github.com/GitbookIO/hunspell-spellchecker) is used to load hunspell formatted dictionaries. Errors are highlighted, and hovering over them will show possible suggestions. The `suggest` function was modified according to [https://github.com/GitbookIO/hunspell-spellchecker/pull/7] to speed up word suggestions.

This extension can be found on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker).

## Benchmarks (sort of)

A 397-line document was used to test the functionality. This was a conference paper that I recently wrote using Pandoc (citeproc and crossref). Simple space separation results in 5134 words. Here are some of the processing times as functionality was added. These were measured using `new Date().getTime()` so results were not consistent.  

* Initial test: 1.577 Minutes
* Added suggestion dictionary for suggestions that have already been processed: 1.0507 minutes
* Removed YAML settings at the beginning of the document (Pandoc settings): 0.841 minutes
* Removed inline citations: 0.50695 minutes
* Removed inline image links: 0.2913 minutes
* Words of length >= 4: 13.931 seconds

Rechecking the document during edits happens much faster ( < 1 sec ).

This same document was checked on a newer computer ( Razer Blade Stealth vs. 4 year old Sony Vaio VPCSA ). Full document checking occurred in 6.842 seconds. Realtime checking while editing occurs in less than 0.01 seconds.

## Known Issues

* Only U.S. English supported
* Entire file is rechecked with each update

## TODO

* Add additional language support
	* Add command to change language
* Add command to create generic settings file in current workspace

## Acknowledgements

Big thanks to Sean McBreen for [Spell and Grammer Check](https://github.com/Microsoft/vscode-spell-check). 

## License

MIT
