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

You can configure the operation of this extension by editing settings in `File > Preferences > Settings`.

The following settings can be changed:

* `spellchecker.language`: supported languages are:
	* English (`"en_US"` or `"en_GB-ise"`)
	* French (`"fr"`)
	* Greek (`"el_GR"`)
	* Spanish (`"es_ANY"`)
  * Swedish (`"sv_SE"`)
* `spellchecker.ignoreWordsList`: an array of strings that contain the words that will not be checked by the spell checker
* `spellchecker.documentTypes`: an array of strings that limit the document types that this extension will check. Default document types are `"markdown"`, `"latex"`, and `"plaintext"`.
* `spellchecker.ignoreFileExtensions`: an array of file extensions that will not be spell checked
* `spellchecker.checkInterval`: number of milliseconds to delay between full document spell checks. Default: 5000 ms.
* `spellchecker.ignoreRegExp`: an array of regular expressions that will be used to remove text from the document before it is checked. Since the expressions are represented in the JSON as strings, all backslashes need to be escaped with three additional backslashes, e.g. `/\s/g` becomes `"/\\\\s/g"`. The following are examples provided in the example configuration file:
	* `"/\\\\(.*\\\\.(jpg|jpeg|png|md|gif|JPG|JPEG|PNG|MD|GIF)\\\\)/g"`: remove links to image and markdown files
	* `"/((http|https|ftp|git)\\\\S*)/g"`: remove hyperlinks
	* `"/^(```\\\\s*)(\\\\w+)?(\\\\s*[\\\\w\\\\W]+?\\\\n*)(```\\\\s*)\\\\n*$/gm"`: remove code blocks

Additional sections are already removed from files, including:

* YAML header for [pandoc](http://pandoc.org/) settings
* `&nbsp;`
* Pandoc citations
* Inline code blocks
* Email addresses

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

* Entire file is rechecked with each update

## TODO

* Update animation demos under Functionality section.

## Release Notes

* `v1.2.12`:
	* Fixed bug in migration of old settings files (#41)
* `v1.2.11`:
	* Increased icon size.
* `v1.2.10`:
	* Added settings to package.json so that VSCode doesn't give warnings when editing `settings.json`.
	* Workspace settings are now included in `.vscode/settings.json`. Previous `.vscode/spellchecker.json` will be migrated with the option to delete.
	* Removed 'CreateConfigurationFile' action because configuration can now be handled though `File > Preferences > Settings`.
	* Added command to set language.
	* Pandoc YAML front matter can end with `...` or `---`.
	* Added Greek language support (Thanks tsangiotis).
	* Added French language support (Thanks adrienjoly).
	* Added extension icon.
	* Changed spell check actions to 'Ignore' (add to workspace dictionary) and 'Always Ignore' (add to user dictionary).
	* Changes to either the user or workspace settings.json will be automatically loaded when changed.
* `v1.2.9`:
	* Fixed #28. The last character of the last suggestion was being cut off.
* `v1.2.8`:
	* Fixed bug introduced by context menu changes when there are no suggested spellings.
* `v1.2.6`:
	* Added Spanish dictionary, es_ANY. Thanks [jmalarcon](https://github.com/jmalarcon)
	* Fixed context menu not handling special characters in suggestions (#25)
* `v1.2.5`:
	* Detect Insider version for different user settings file.
* `v1.2.4`:
	* Add svg and pdf to `ignoreRegExp` (#16, Thanks [wingsuitist](https://github.com/wingsuitist))
	* Fixed wrong/incomplete comment removal in settings (#20, Thanks [devjb](https://github.com/devjb))
* `v1.2.3`:
	* Adding extra output to configuration file creation to help track down errors during this process
* `v1.2.2`:
	* Only process files with `uri.scheme = 'file'` (See #15)
	* Find suggestions for words that do not contain numbers (See #15)
	* Added GB English dictionary (#12)
* `v1.2.1`:
	* Fixed some regex's mangling text parsing by replacing spaces instead of null.
	* Fixed error with creating settings file to `.vscode` folder that doesn't exist.
	* Added command to show current `documentType` to make it easier to add new types to check.
* `v1.2.0`:
	* Fixed files not being opened when workspace was not opened.
	* Added `checkInterval` setting so that spelling isn't checked with every edit but rather after a specified interval.
	* For long files or files with lots of errors, VSCode can freeze because the spell checker takes too long. The error list only shows 250 errors, so checking is stopped after that number has been found. When this happens, a message `"Over 250 spelling errors found!"` is displayed in the status bar for 5 seconds.
	* `Add word to dictionary` function now saves the word to the workspace's `spellchecker.json`.
	* User Preferences can now include Spell Checker settings.
	* Added `Always ignore word` option. Settings save in the User Preferences.
	* Added `~` to the list of characters to ignore before spell checking.
	* Removed latex commands from spell checking, e.g. `\begin{matrix}`.
	* Added `Create Spell Checker Settings File` command.
* `v1.1.6`:
	* Words under 50 characters in length will be checked for suggestions. The longest English word is 45 characters.
	* Add setting `ignoreFileExtensions` to ignore spell checking on files with certain extensions
* `v1.1.5`:
	* Fixed parsing leading quotation marks didn't work when the marks were in front of a number
* `v1.1.4`:
	* Fixed error with tab characters not being removed from text
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
