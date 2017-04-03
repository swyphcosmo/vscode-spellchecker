'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
let mkdirp = require( 'mkdirp' );
let sc = require( 'spellchecker' );
let jsonMinify = require( 'jsonminify' );

// Toggle debug output
let DEBUG:boolean = false;

const DEFAULT_LANG:string = 'fr'; // 'en_US';

interface SpellSettings {
	language: string,
	ignoreWordsList: string[];
	documentTypes: string[];
	ignoreRegExp: string[];
	ignoreFileExtensions: string[];
	checkInterval: number;
}

export default class SpellCheckerProvider implements vscode.CodeActionProvider 
{
	private static suggestCommandId: string = 'SpellChecker.fixSuggestionCodeAction';
	private static ignoreCommandId: string = 'SpellChecker.ignoreCodeAction';	
	private static alwaysIgnoreCommandId: string = 'SpellChecker.alwaysIgnoreCodeAction';
	private suggestCommand: vscode.Disposable;
	private ignoreCommand: vscode.Disposable;
	private alwaysIgnoreCommand: vscode.Disposable;
	private diagnosticCollection: vscode.DiagnosticCollection;
	private problemCollection = {};
	private diagnosticMap = {};
	private DICT = undefined;
	private settings: SpellSettings;
	private static CONFIGFILE: string = '';
	private SpellChecker = sc;
	private extensionRoot: string;
	private lastcheck: number = -1;
	private timer = null;
	private timerTextDocument: vscode.TextDocument;

	public activate( context: vscode.ExtensionContext )
	{
		let subscriptions: vscode.Disposable[] = context.subscriptions;

		this.extensionRoot = context.extensionPath;

		this.settings = this.getSettings();
		this.setLanguage( this.settings.language );

		vscode.commands.registerCommand( 'spellchecker.createSettingsFile', this.createSettingsFile, this );
		vscode.commands.registerCommand( 'spellchecker.showDocumentType', this.showDocumentType, this );
		// vscode.commands.registerCommand( 'spellchecker.setLanguage', SetLanguage );

		this.suggestCommand = vscode.commands.registerCommand( SpellCheckerProvider.suggestCommandId, this.fixSuggestionCodeAction, this );
		this.ignoreCommand = vscode.commands.registerCommand( SpellCheckerProvider.ignoreCommandId, this.ignoreCodeAction, this );
		this.alwaysIgnoreCommand = vscode.commands.registerCommand( SpellCheckerProvider.alwaysIgnoreCommandId, this.alwaysIgnoreCodeAction, this );
		subscriptions.push( this );
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection( 'Spelling' );

		vscode.workspace.onDidOpenTextDocument( this.doSpellCheck, this, subscriptions );
		vscode.workspace.onDidCloseTextDocument( ( textDocument ) => 
		{
			this.diagnosticCollection.delete( textDocument.uri );
		}, null, subscriptions);

		vscode.workspace.onDidSaveTextDocument( this.doSpellCheck, this, subscriptions );
		
		vscode.workspace.onDidChangeTextDocument( this.doDiffSpellCheck, this, subscriptions );

		// Spell check all open documents
		vscode.workspace.textDocuments.forEach( this.doSpellCheck, this );

		// register code actions provider
		for( let i = 0; i < this.settings.documentTypes.length; i++ )
			vscode.languages.registerCodeActionsProvider( this.settings.documentTypes[ i ], this );
	}

	public dispose(): void
	{
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
		this.suggestCommand.dispose();
		this.ignoreCommand.dispose();
		this.alwaysIgnoreCommand.dispose();
	}

	private createSettingsFile(): void
	{
		if( SpellCheckerProvider.CONFIGFILE.length > 0 && !fs.existsSync( SpellCheckerProvider.CONFIGFILE ) )
		{
			console.log( 'Spell checker configuration file not found' );
			console.log( 'Creating file \'' + SpellCheckerProvider.CONFIGFILE + '\'' );

			let defaultSettings: SpellSettings = {
				language: DEFAULT_LANG,
				ignoreWordsList: [],
				documentTypes: [ 'markdown', 'latex', 'plaintext' ],
				ignoreRegExp: [],
				ignoreFileExtensions: [],
				checkInterval: 5000
			};

			this.saveWorkspaceSettings( defaultSettings );
		}
		else if( fs.existsSync( SpellCheckerProvider.CONFIGFILE ) )
		{
			console.log( 'Spell checker configuration file already exists' );
			console.log( 'Contents of \'' + SpellCheckerProvider.CONFIGFILE + '\'' );
			console.log( fs.readFileSync( SpellCheckerProvider.CONFIGFILE, 'utf-8' ) );
		}
		else
		{
			console.log( 'Invalid Spell checker configuration file name: \'' +  + SpellCheckerProvider.CONFIGFILE + '\'' );
		}
	}

	private showDocumentType(): void
	{
		if( vscode.workspace.textDocuments.length > 0 )
		{
			vscode.window.showInformationMessage( 'The documentType for the current file is \'' + vscode.workspace.textDocuments[ 0 ].languageId + '\'.' );
		}
		else
		{
			vscode.window.showErrorMessage( 'documentType not found.' );
		}
	}

	private doDiffSpellCheck( event:vscode.TextDocumentChangeEvent )
	{
		// Is this a document type that we should check?
		if( this.settings.documentTypes.indexOf( event.document.languageId ) < 0 )
		{
			return;
		}

		// Is this a file extension that we should ignore?
		if( this.settings.ignoreFileExtensions.indexOf( path.extname( event.document.fileName ) ) >= 0 )
		{
			return;
		}

		if( Date.now() - this.lastcheck > this.settings.checkInterval )
		{
			clearTimeout( this.timer );
			this.doSpellCheck( event.document );
		}
		else
		{
			clearTimeout( this.timer );
			this.timerTextDocument = event.document; 
			this.timer = setTimeout( this.doSpellCheck.bind( this ), 2 * this.settings.checkInterval );
		}
	}

	private doSpellCheck( textDocument: vscode.TextDocument )
	{
		if( textDocument == null )
		{
			textDocument = this.timerTextDocument;
		}

		if( DEBUG )
			console.log( "documentType for " + textDocument.fileName + " is " + textDocument.languageId );

		if( DEBUG )
			console.log( textDocument );

		// Is this a private URI? (VSCode started having "private:" versions of non-plaintext documents with languageId = 'plaintext')
		if( textDocument.uri.scheme != "file" )
		{
			return;
		}

		// Is this a document type that we should check?
		if( this.settings.documentTypes.indexOf( textDocument.languageId ) < 0 )
		{
			return;
		}

		// Is this a file extension that we should ignore?
		if( this.settings.ignoreFileExtensions.indexOf( path.extname( textDocument.fileName ) ) >= 0 )
		{
			return;
		}

		let startTime = new Date().getTime();
		let lastSeconds: number = 0;
		if( DEBUG )
			console.log( 'Starting spell check on ' + textDocument.fileName );

		let diagnostics: vscode.Diagnostic[] = [];

		let textoriginal = textDocument.getText();

		// change to common line endings
		textoriginal = textoriginal.replace( /\r?\n/g, '\n' );
		let text = textoriginal;

		text = this.processUserIgnoreRegex( text );

		if (/\.ya?ml$/.test(textDocument.fileName)) {
			text = text.replace( /---(.|\n)*\.\.\./g, ' ' ); // do this on yaml files only
		}

		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove '&nbsp;'
		text = text.replace( /&nbsp;/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove citations
		text = text.replace( /\[-?@[A-Za-z:0-9\-]*\]/g, ' ' );
		text = text.replace( /\{(\#|\.)[A-Za-z:0-9]+\}/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove code blocks
		text = text.replace( /^(```\s*)(\w+)?(\s*[\w\W]+?\n*)(```\s*)\n*$/gm, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove inline code blocks
		text = text.replace( /`[\w\W]+?`/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove image links
		// text = text.replace( /\]\([a-zA-Z0-9\/\\\.]+\)/g, ' ' );
		text = text.replace( /\(.*\.(jpg|jpeg|png|md|gif|pdf|svg)\)/gi, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove web links
		text = text.replace( /(http|https|ftp|git)\S*/g, ' ' )
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove email addresses 
		text = text.replace( /[a-zA-Z.\-0-9]+@[a-z.]+/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove non-letter characters
		text = text.replace( /[`\"!#$%&()*+,.\/:;<=>?@\[\]\\^_{|}\n\r\-~]/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove numbers:
		text = text.replace( / [0-9]+/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove leading quotations
		text = text.replace( /[\s ]['"]([a-zA-Z0-9])/g, ' $1' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove trailing quotations
		text = text.replace( /' /g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// convert tabs to spaces
		text = text.replace( /\t/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove LaTeX commands
		text = text.replace( /\\\w*\{.*?\}/g, ' ' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}

		let lastposition = 0;
		let position = 0;
		let linenumber = 0;
		let colnumber = 0;
		let lastline = 0;

		let tokens = text.split( ' ' );
		let lines = textoriginal.split( '\n' );

		if( DEBUG )
			console.log( 'Num tokens: ' + String( tokens.length ) );

		for( let i in tokens )
		{
			if( DEBUG )
			{
				let currTime = new Date().getTime();
				let seconds: number = Math.floor( ( currTime - startTime ) / 1000 );

				if( seconds % 10 == 0 && lastSeconds != seconds )
				{
					lastSeconds = seconds;
					console.log( "Elapsed time: " + seconds + " seconds" );
				}
			}

			let token = tokens[ i ];
			if( token.length > 3 )
			{
				// find line number and column number
				position = lines[ linenumber ].indexOf( token, lastposition );
				while( position < 0 )
				{
					lastposition = 0;
					linenumber++;
					if( linenumber < lines.length )
						position = lines[ linenumber ].indexOf( token, lastposition );
					else
						console.log( 'Error text not found: ' + token );
				}

				colnumber = position;
				lastposition = position + 1;

				if( token.indexOf( '’' ) >= 0 )
				{
					token = token.replace( /’/, '\'' );
				}

				if( this.SpellChecker.isMisspelled( token ) )
				{
					if( DEBUG )
						console.log( 'Error: \'' + token + '\', line ' + String( linenumber + 1 ) + ', col ' + String( colnumber + 1 ) );

					let lineRange = new vscode.Range( linenumber, colnumber, linenumber, colnumber + token.length );

					// Make sure word isn't in the ignore list
					if( this.settings.ignoreWordsList.indexOf( token ) < 0 )
					{
						if( token in this.problemCollection )
						{
							let diag = new vscode.Diagnostic( lineRange, this.problemCollection[ token ], vscode.DiagnosticSeverity.Error );
							diag.source = 'Spell Checker';
							diagnostics.push( diag );
						}
						else
						{
							let message = 'Spelling [ ' + token + ' ]: suggestions [ ';
							let containsNumber = token.match( /[0-9]+/g );
							
							if( token.length < 50 && containsNumber == null )
							{
								let suggestions = this.SpellChecker.getCorrectionsForMisspelling( token );
								for( let s of suggestions )
								{
									message += s + ', ';
								}
								if( suggestions.length > 0 )
									message = message.slice( 0, message.length - 2 );
							}
							message += ' ]';

							if( DEBUG )
								console.log( message );

							let diag = new vscode.Diagnostic( lineRange, message, vscode.DiagnosticSeverity.Error );
							diag.source = 'Spell Checker';
							diagnostics.push( diag );

							if( diagnostics.length > 250 )
							{
								vscode.window.setStatusBarMessage( "Over 250 spelling errors found!", 5000 );
								break;
							}

							this.problemCollection[ token ] = message;
						}
					}
				}
			}
		}
		this.diagnosticCollection.set( textDocument.uri, diagnostics );
		// create local copy so it can be updated
		this.diagnosticMap[ textDocument.uri.toString() ] = diagnostics;

		let endTime = new Date().getTime();
		let minutes = ( endTime - startTime ) / 1000;
		if( DEBUG )
		{
			console.log( 'Check completed in ' + String( minutes ) );
			console.log( 'Found ' + String( diagnostics.length ) + ' errors' );
		}

		this.lastcheck = Date.now();
	}

	private processUserIgnoreRegex( text: string ): string
	{
		for( let i = 0; i < this.settings.ignoreRegExp.length; i++ )
		{
			// Convert the JSON of regExp Strings into a real RegExp
			let flags = this.settings.ignoreRegExp[ i ].replace( /.*\/([gimy]*)$/, '$1' );
			let pattern = this.settings.ignoreRegExp[ i ].replace( new RegExp('^/(.*?)/' + flags + '$'), '$1' );

			pattern = pattern.replace( /\\\\/g, '\\' );

			if( DEBUG )
			{
				console.log( this.settings.ignoreRegExp[ i ] );
				console.log( pattern );
				console.log( flags );
			}

			let regex = new RegExp( pattern, flags );

			if( DEBUG )
				console.log( text.match( regex ) );
			
			text = text.replace( regex, ' ' );	

		}

		return text;
	}

	public provideCodeActions( document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken ): vscode.Command[]
	{
		let diagnostic:vscode.Diagnostic = context.diagnostics[ 0 ];

		if( !diagnostic )
			return null;

		// Get word
		let match:string[] = diagnostic.message.match( /^Spelling \[\ (.+)\ \]\:/ );
		if( DEBUG && match )
		{
			console.log( 'Code action: match word' );
			match.forEach( function( m )
			{
				console.log( m );
			});
		}
		let word:string = '';

		// should always be true
		if( match.length >= 2 )
			word = match[ 1 ];

		if( word.length == 0 )
			return undefined;

		// Get suggestions
		match = diagnostic.message.match( /suggestions \[\ (.+)\ \]$/ );
		if( DEBUG && match )
		{
			console.log( 'Code action: match suggestions' );
			match.forEach( function( m )
			{
				console.log( m );
			});
		}
		let suggestionstring:string = '';

		let commands:vscode.Command[] = [];

		if( match && match.length >= 2 )
		{
			suggestionstring = match[ 1 ];

			let suggestions: string[] = suggestionstring.split( /\,\ /g );

			// Add suggestions to command list
			suggestions.forEach( function( suggestion )
			{
				commands.push( {
					title: 'Replace with \'' + suggestion + '\'',
					command: SpellCheckerProvider.suggestCommandId,
					arguments: [ document, diagnostic, word, suggestion ]
				});
			});
		}

		commands.push( {
			title: 'Add \'' + word + '\' to dictionary',
			command: SpellCheckerProvider.ignoreCommandId,
			arguments: [ document, word ]
		});

		commands.push( {
			title: 'Always ignore \'' + word + '\'',
			command: SpellCheckerProvider.alwaysIgnoreCommandId,
			arguments: [ document, word ]
		});

		return commands;
	}

	private fixSuggestionCodeAction( document: vscode.TextDocument, diagnostic:vscode.Diagnostic, word:string, suggestion:string ): any
	{
		let docWord:string = document.getText( diagnostic.range );

		if( word == docWord )
		{
			// Remove diagnostic from list
			let diagnostics:vscode.Diagnostic[] = this.diagnosticMap[ document.uri.toString() ];
			let index:number = diagnostics.indexOf( diagnostic );
			
			diagnostics.splice( index, 1 );

			// Update with new diagnostics
			this.diagnosticMap[ document.uri.toString() ] = diagnostics;
			this.diagnosticCollection.set( document.uri, diagnostics );

			// Insert the new text
			let edit = new vscode.WorkspaceEdit();
			edit.replace( document.uri, diagnostic.range, suggestion );
			return vscode.workspace.applyEdit( edit );
		}
		else
		{
			vscode.window.showErrorMessage( 'The suggestion was not applied because it is out of date. You might have tried to apply the same edit twice.' );
		}
	}

	private ignoreCodeAction( document: vscode.TextDocument, word: string ): any
	{
		if( this.addWordToIgnoreList( word, true ) )
		{
			this.doSpellCheck( document );
		}
		else
		{
			vscode.window.showWarningMessage( 'The word has already been added to the ignore list. You might have tried to add the same word twice.' );			
		}
	}

	private alwaysIgnoreCodeAction( document: vscode.TextDocument, word: string ): any
	{
		if( DEBUG )
		{
			console.log( word );
			console.log( document );
			console.log( Object.keys( document ) );
		}
		if( this.addWordToAlwaysIgnoreList( word ) )
		{
			this.doSpellCheck( document );
		}
		else
		{
			vscode.window.showWarningMessage( 'The word has already been added to the ignore list. You might have tried to add the same word twice.' );			
		}
	}

	public addWordToIgnoreList( word: string, save: boolean ): boolean
	{
		// Only add the word if it's not already in the list
		if( this.settings.ignoreWordsList.indexOf( word ) < 0 )
		{
			this.settings.ignoreWordsList.push( word );
			this.saveWorkspaceSettings( this.settings );
			return true;
		}
		
		return false;
	}

	public addWordToAlwaysIgnoreList( word: string ): boolean
	{
		if( this.addWordToIgnoreList( word, false ) )
		{
			let userSettingsData = this.getUserSettings();
			if( Object.keys( userSettingsData ).indexOf( 'spellchecker.ignoreWordsList' ) > 0 )
			{
				if( userSettingsData[ 'spellchecker.ignoreWordsList' ].indexOf( word ) < 0 )
				{
					userSettingsData[ 'spellchecker.ignoreWordsList' ].push( word );
					this.saveUserSettings( userSettingsData );
					return true;
				}
				else
					return false;
			}
			else
			{
				userSettingsData[ 'spellchecker.ignoreWordsList' ] = [ word ];
				this.saveUserSettings( userSettingsData );
				return true;
			}
		}
		return false;
	}

	public setLanguage( language: string = DEFAULT_LANG ): void
	{
		// console.log( path.join( extensionRoot, 'languages', settings.language + '.aff' ) )
		this.settings.language = language;
		this.SpellChecker.setDictionary(language);
	}

	public getDocumentTypes(): string[]
	{
		return this.settings.documentTypes;
	}

	private getUniqueArray( array ): string[]
	{
		let a: string[] = array.concat();
		for( var i = 0; i < a.length; ++i )
		{
			for( var j = i + 1; j < a.length; ++j )
			{
				if( a[ i ] === a[ j ] )
					a.splice( j--, 1 );
			}
		}

		return a;
	}

	private getUserSettingsFilename(): string
	{
		let codeFolder = 'Code';
		if( vscode.version.indexOf( 'insider' ) >= 0 )
			codeFolder = 'Code - Insiders';
		if( process.platform == 'win32' )
			return path.join( process.env.APPDATA, codeFolder, 'User', 'settings.json' );
		else if( process.platform == 'darwin' )
			return path.join( process.env.HOME, 'Library', 'Application Support', codeFolder, 'User', 'settings.json' );
		else if( process.platform == 'linux' )
			return path.join( process.env.HOME, '.config', codeFolder, 'User', 'settings.json' );
		else
			return "";
	}

	private getUserSettings(): any
	{
		// Check user settings
		let userSettingsFilename: string = this.getUserSettingsFilename();

		if( userSettingsFilename.length > 0 )
		{
			if( fs.existsSync( userSettingsFilename ) )
			{
				let userSettingsFile: string = fs.readFileSync( userSettingsFilename, 'utf-8' );

				// parse and remove any comment lines in the settings file
				return JSON.parse( jsonMinify( userSettingsFile ) );
			}
		}
		
		return null;
	}

	private saveUserSettings( settings ): boolean
	{
		let userSettingsFilename: string = this.getUserSettingsFilename();

		if( userSettingsFilename.length > 0 )
		{
			let data: string = "// Place your settings in this file to overwrite the default settings\n" + JSON.stringify( settings, null, 4 );
			fs.writeFileSync( userSettingsFilename, data );
			return true;
		}
		else
			return false;
	}

	private saveWorkspaceSettings( settings: SpellSettings ): void
	{
		if( SpellCheckerProvider.CONFIGFILE.length > 0 )
		{
			console.log( 'Saving spell check configuration' );
			console.log( path.dirname( SpellCheckerProvider.CONFIGFILE ) );
			try
			{
				mkdirp.sync( path.dirname( SpellCheckerProvider.CONFIGFILE ) );
				fs.writeFileSync( SpellCheckerProvider.CONFIGFILE, JSON.stringify( settings, null, 4 ) );
			}
			catch( e )
			{
				console.log( e );
			}
		}
	}

	private getSettings() : SpellSettings
	{
		let returnSettings: SpellSettings = {
			language: DEFAULT_LANG,
			ignoreWordsList: [],
			documentTypes: [ 'markdown', 'latex', 'plaintext' ],
			ignoreRegExp: [],
			ignoreFileExtensions: [],
			checkInterval: 5000
		};

		// Check user settings
		let userSettingsData = this.getUserSettings();

		if( userSettingsData )
		{
			Object.keys( returnSettings ).forEach( function( key )
			{
				if( userSettingsData[ 'spellchecker.' + key ] )
				{
					returnSettings[ key ] = userSettingsData[ 'spellchecker.' + key ];
				}
			});
		}

		if( SpellCheckerProvider.CONFIGFILE.length == 0 && vscode.workspace.rootPath )
		{
			SpellCheckerProvider.CONFIGFILE = path.join( vscode.workspace.rootPath, '.vscode', 'spellchecker.json' );
		}

		if( SpellCheckerProvider.CONFIGFILE.length > 0 && fs.existsSync( SpellCheckerProvider.CONFIGFILE ) )
		{
			let settings: SpellSettings = JSON.parse( jsonMinify( fs.readFileSync( SpellCheckerProvider.CONFIGFILE, 'utf-8' ) ) );

			if( DEBUG )
			{
				console.log( 'Found configuration file' );
				console.log( settings );
			}

			Object.keys( returnSettings ).forEach( function( key )
			{
				if( Array.isArray( returnSettings[ key ] ) )
					returnSettings[ key ] = this.getUniqueArray( returnSettings[ key ].concat( settings[ key ] ) );
				else
					returnSettings[ key ] = settings[ key ];
			}, this );
		}
		else
		{
			if( DEBUG )
				console.log( 'Configuration file not found: ' + SpellCheckerProvider.CONFIGFILE );
		}

		return returnSettings;
	}
}