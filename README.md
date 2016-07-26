# Offline Spell Checker

[![Current Version](http://vsmarketplacebadge.apphb.com/version/swyphcosmo.spellchecker.svg)](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker)
[![Install Count](http://vsmarketplacebadge.apphb.com/installs/swyphcosmo.spellchecker.svg)](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker)

## Description 

This extension is a spell checker that uses a local dictionary for offline usage. [hunspell-spellchecker](https://github.com/GitbookIO/hunspell-spellchecker) is used to load hunspell formatted dictionaries. Errors are highlighted, and hovering over them will show possible suggestions. The `suggest` function was modified according to [https://github.com/GitbookIO/hunspell-spellchecker/pull/7] to speed up word suggestions.

This extension can be found on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=swyphcosmo.spellchecker).

## Functionality

Once errors are highlighted, there are several ways to view word suggestions.

Hover over the error: 

![Hover](images/hover-view.png)

By pressing `F8` to step through errors:

![Error View](images/error-view.png)

You can correct the error by clicking on the Quick Fix (light bulb) icon. 

![Quick Fix](images/making-corrections.gif)

## Configuration File

You can configure the operation of this extension by placing a file called `spellchecker.json` into your workspace's `.vscode` folder.

An example configuration file can be found [here](https://github.com/swyphcosmo/vscode-spellchecker/blob/master/settings/spellchecker.json). 

The following settings can be changed:

* `language`: currently the only supported language is US English so the only valid value is `"en_US"`
* `ignoreWordsList`: an array of strings that contain the words that will not be checked by the spell checker
* `documentTypes`: an array of strings that limit the document types that this extension will check. Default document types are `"markdown"`, `"latex"`, and `"plaintext"`.
* `ignoreRegExp`: an array of regular expressions that will be used to remove text from the document before it is checked. Since the expressions are represented in the JSON as strings, all backslashes need to be escaped with three additional backslashes, e.g. `/\s/g` becomes `"/\\\\s/g"`. The following are examples provided in the example configuration file:
	* `"/\\\\(.*\\\\.(jpg|jpeg|png|md|gif|JPG|JPEG|PNG|MD|GIF)\\\\)/g"`: remove links to image and markdown files
	* `"/((http|https|ftp|git)\\\\S*)/g"`: remove hyperlinks
	* `"/^(```\\\\s*)(\\\\w+)?(\\\\s*[\\\\w\\\\W]+?\\\\n*)(```\\\\s*)\\\\n*$/gm"`: remove code blocks

Additional sections are already removed from files, including:

* YAML header for [pandoc](http://pandoc.org/) settings
* `&nbsp;`
* Pandoc citations 
* Inline code blocks
* Email addresses

>**Note:** If this file is updated manually, you will need to reload VSCode for changes to take effect.

## Benchmarks (sort of)

A 397-line document was used to test the functionality. This was a conference paper that I recently wrote using Pandoc (citeproc and crossref). Simple space separation results in 5134 words. Here are some of the processing times as functionality was added. These were measured using `new Date().getTime()` so results were not consistent.  

* Initial test: 1.577 minutes
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
* Ignore list changes are not saved

## TODO

* Add additional language support
	* Add command to change language
* Add command to create generic settings file in current workspace

## Release Notes

* `v1.1.3`:
	* Fixed error in parsing quotation marks at the beginning of words
* `v1.1.1`:
	* More detailed README
	* Replaced right single quotation mark (character code 0x2019) when used in contractions
* `v1.1.0`
	* Initial release

## Acknowledgements

Big thanks to Sean McBreen for [Spell and Grammar Check](https://github.com/Microsoft/vscode-spell-check). 

## License

MIT
