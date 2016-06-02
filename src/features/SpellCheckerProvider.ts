'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
let sc = require( '../../../lib/hunspell-spellchecker/lib/index.js' );

let DEBUG:boolean = false;

interface SpellSettings {
    language: string,
    ignoreWordsList: string[];
    mistakeTypeToStatus: {}[];
    languageIDs: string[];
    ignoreRegExp: string[];
}

export default class SpellCheckerProvider implements vscode.CodeActionProvider 
{
	private static suggestCommandId: string = 'SpellChecker.fixSuggestionCodeAction';
	private static ignoreCommandId: string = 'SpellChecker.ignoreCodeAction';	
	private command: vscode.Disposable;
	private diagnosticCollection: vscode.DiagnosticCollection;
    private problemCollection = {};
	private diagnosticMap = {};
    private DICT = undefined;
    private settings: SpellSettings;
    private static CONFIGFILE = vscode.workspace.rootPath + "/.vscode/spell.json";
    private SpellChecker = new sc();
    private extensionRoot: string;

	public activate( context: vscode.ExtensionContext )
    {
        let subscriptions: vscode.Disposable[] = context.subscriptions;
        
        this.extensionRoot = context.extensionPath;
        
        this.settings = this.GetSettings();
        this.SetLanguage( this.settings.language );
        
		this.command = vscode.commands.registerCommand( SpellCheckerProvider.suggestCommandId, this.fixSuggestionCodeAction, this );
		this.command = vscode.commands.registerCommand( SpellCheckerProvider.ignoreCommandId, this.ignoreCodeAction, this );		
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
	}

	public dispose(): void
    {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();
		this.command.dispose();
	}
	
	private doDiffSpellCheck( event:vscode.TextDocumentChangeEvent )
	{
		this.doSpellCheck( event.document );
	}

	private doSpellCheck( textDocument: vscode.TextDocument )
    {
		if( DEBUG )
        	console.log( textDocument.languageId );
			
		if( textDocument.languageId !== 'markdown' && textDocument.languageId !== 'plaintext' )
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
        // remove pandoc yaml header
        text = text.replace( /---(.|\n)*\.\.\./g, '' );
        // remove citations
        text = text.replace( /\[-?@[A-Za-z:0-9\-]*\]/g, '' );
        text = text.replace( /\{(\#|\.)[A-Za-z:0-9]+\}/g, '' );
        // remove image links
        text = text.replace( /\]\([a-zA-Z0-9\/\\\.]+\)/g, ' ' );
        // remove email addresses 
        text = text.replace( /[a-zA-Z.\-0-9]+@[a-z.]+/g, ' ' );
        // remove non-letter characters
        text = text.replace( /[`\"!#$%&()*+,.\/:;<=>?@\[\]\\^_{|}\n\r\-]/g, ' ' );
        // remove numbers:
        text = text.replace( / [0-9]+/g, ' ' );
        // remove leading quotations
        text = text.replace( /[\s ]['"]([a-zA-Z])/g, '$1' );
        // remove trailing quotations
        text = text.replace( /' /g, ' ' );
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
                    position = lines[ linenumber ].indexOf( token, lastposition );
                }
                
                colnumber = position;
                lastposition = position;
                
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
		if( this.AddWordToIgnoreList( word ) )
		{
			this.doSpellCheck( document );
		}
		else
		{
			vscode.window.showErrorMessage( 'The word has already been added to the ignore list. You might have tried to add the same word twice.' );			
		}
	}
	
	public AddWordToIgnoreList( word: string ): boolean
	{
		if( this.settings.ignoreWordsList.indexOf( word ) < 0 )
		{
			this.settings.ignoreWordsList.push( word );
			return true;
		}
		
		return false;
	}
    
    public SetLanguage( language: string = 'en_US' ): void
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

    private GetSettings() : SpellSettings
    {
        return {
            language: 'en_US',
            ignoreWordsList: [],
            mistakeTypeToStatus: [],
            languageIDs: [],
            ignoreRegExp: []
        };
    }
}