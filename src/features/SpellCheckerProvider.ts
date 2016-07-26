'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
let sc = require( '../../../lib/hunspell-spellchecker/lib/index.js' );

// Toggle debug output
let DEBUG:boolean = false;

interface SpellSettings {
	language: string,
	ignoreWordsList: string[];
	documentTypes: string[];
	ignoreRegExp: string[];
}

export default class SpellCheckerProvider implements vscode.CodeActionProvider 
{
	private static suggestCommandId: string = 'SpellChecker.fixSuggestionCodeAction';
	private static ignoreCommandId: string = 'SpellChecker.ignoreCodeAction';	
	private suggestCommand: vscode.Disposable;
	private ignoreCommand: vscode.Disposable;
	private diagnosticCollection: vscode.DiagnosticCollection;
	private problemCollection = {};
	private diagnosticMap = {};
	private DICT = undefined;
	private settings: SpellSettings;
	private static CONFIGFILE: string = '';
	private SpellChecker = new sc();
	private extensionRoot: string;

	public activate( context: vscode.ExtensionContext )
	{
		let subscriptions: vscode.Disposable[] = context.subscriptions;
		
		this.extensionRoot = context.extensionPath;
		
		this.settings = this.getSettings();
		this.setLanguage( this.settings.language );
		
		// vscode.commands.registerCommand( 'spellchecker.suggest', Suggest );
		// vscode.commands.registerCommand( 'spellchecker.setLanguage', SetLanguage );

		this.suggestCommand = vscode.commands.registerCommand( SpellCheckerProvider.suggestCommandId, this.fixSuggestionCodeAction, this );
		this.ignoreCommand = vscode.commands.registerCommand( SpellCheckerProvider.ignoreCommandId, this.ignoreCodeAction, this );		
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
	}
	
	private doDiffSpellCheck( event:vscode.TextDocumentChangeEvent )
	{
		this.doSpellCheck( event.document );
	}

	private doSpellCheck( textDocument: vscode.TextDocument )
	{
		if( DEBUG )
			console.log( textDocument.languageId );
			
		if( this.settings.documentTypes.indexOf( textDocument.languageId ) < 0 )
		{
			return;
		}
		
		let startTime = new Date().getTime();
		if( DEBUG )
			console.log( 'Starting spell check on ' + textDocument.fileName );
		
		let diagnostics: vscode.Diagnostic[] = [];
		
		let textoriginal = textDocument.getText();
		
		// change to common line endings
		textoriginal = textoriginal.replace( /\r?\n/g, '\n' );
		let text = textoriginal;

		text = this.processUserIgnoreRegex( text );
		
		// remove pandoc yaml header
		text = text.replace( /---(.|\n)*\.\.\./g, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove '&nbsp;'
		text = text.replace( /&nbsp;/g, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove citations
		text = text.replace( /\[-?@[A-Za-z:0-9\-]*\]/g, '' );
		text = text.replace( /\{(\#|\.)[A-Za-z:0-9]+\}/g, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove code blocks
		text = text.replace( /^(```\s*)(\w+)?(\s*[\w\W]+?\n*)(```\s*)\n*$/gm, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove inline code blocks
		text = text.replace( /`[\w\W]+?`/g, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove image links
		// text = text.replace( /\]\([a-zA-Z0-9\/\\\.]+\)/g, ' ' );
		text = text.replace( /\(.*\.(jpg|jpeg|png|md|gif)\)/gi, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove web links
		text = text.replace( /(http|https|ftp|git)\S*/g, '' )
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove email addresses 
		text = text.replace( /[a-zA-Z.\-0-9]+@[a-z.]+/g, '' );
		if( DEBUG )
		{
			console.log( text );
			console.log( '------------------------------------------' );
		}
		// remove non-letter characters
		text = text.replace( /[`\"!#$%&()*+,.\/:;<=>?@\[\]\\^_{|}\n\r\-]/g, ' ' );
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
		text = text.replace( /[\s ]['"]([a-zA-Z])/g, ' $1' );
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
				lastposition = position;

				if( token.indexOf( '’' ) >= 0 )
				{
					token = token.replace( /’/, '\'' );
				}
				
				if( !this.SpellChecker.check( token ) )
				{
					// console.log( 'Error: \'' + token + '\', line ' + String( linenumber + 1 ) + ', col ' + String( colnumber + 1 ) );
					
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
							let suggestions = this.SpellChecker.suggest( token );
							for( let s of suggestions )
							{
								message += s + ', ';
							}
							if( suggestions.length > 0 )
								message = message.slice( 0, message.length - 3 );
							message += ' ]';
							
							// console.log( message );

							let diag = new vscode.Diagnostic( lineRange, message, vscode.DiagnosticSeverity.Error );
							diag.source = 'Spell Checker';
							diagnostics.push( diag );
							
							this.problemCollection[ token ] = message;
						}
					}
				}
			}
		}
		// console.log( diagnostics );
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

		// Get word
		let match:string[] = diagnostic.message.match( /\[\ ([a-zA-Z0-9]+)\ \]\:/ );
		let word:string = '';

		// should always be true
		if( match.length >= 2 )
			word = match[ 1 ];
			
		if( word.length == 0 )
			return undefined;
		
		// Get suggestions
		match = diagnostic.message.match( /\[\ ([a-zA-Z0-9,\ ]+)\ \]$/ );
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
		if( this.addWordToIgnoreList( word ) )
		{
			this.doSpellCheck( document );
		}
		else
		{
			vscode.window.showWarningMessage( 'The word has already been added to the ignore list. You might have tried to add the same word twice.' );			
		}
	}
	
	public addWordToIgnoreList( word: string ): boolean
	{
		// Only add the word if it's not already in the list
		if( this.settings.ignoreWordsList.indexOf( word ) < 0 )
		{
			this.settings.ignoreWordsList.push( word );
			return true;
		}
		
		return false;
	}
	
	public setLanguage( language: string = 'en_US' ): void
	{
		// console.log( path.join( extensionRoot, 'languages', settings.language + '.aff' ) )
		this.settings.language = language;
		this.DICT = this.SpellChecker.parse(
			{
				aff: fs.readFileSync( path.join( this.extensionRoot, 'languages', this.settings.language + '.aff' ) ),
				dic: fs.readFileSync( path.join( this.extensionRoot, 'languages', this.settings.language + '.dic' ) )
			});
			
		this.SpellChecker.use( this.DICT );
	}

	public getDocumentTypes(): string[]
	{
		return this.settings.documentTypes;
	}

	private getSettings() : SpellSettings
	{
		if( SpellCheckerProvider.CONFIGFILE.length == 0 )
		{
			SpellCheckerProvider.CONFIGFILE = path.join( vscode.workspace.rootPath, '.vscode', 'spellchecker.json' );
		}

		if( fs.existsSync( SpellCheckerProvider.CONFIGFILE ) )
		{
			let settings: SpellSettings = JSON.parse( fs.readFileSync( SpellCheckerProvider.CONFIGFILE, 'utf-8' ) );

			if( DEBUG )
			{
				console.log( 'Found configuration file' );			
				console.log( settings );
			}

			return settings;
		}
		else
		{
			if( DEBUG )
				console.log( 'Configuration file not found: ' + SpellCheckerProvider.CONFIGFILE );

			return {
				language: 'en_US',
				ignoreWordsList: [],
				documentTypes: [ 'markdown', 'latex', 'plaintext' ],
				ignoreRegExp: []
			};
		}
	}
}