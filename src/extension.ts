'use strict';

import * as vscode from 'vscode';
import fs = require( 'fs' );
import path = require( 'path' );
// let sc = require( 'hunspell-spellchecker' );
let sc = require( '../../lib/hunspell-spellchecker/lib/index.js' );

interface SpellMDSettings {
    language: string,
    ignoreWordsList: string[];
    mistakeTypeToStatus: {}[];
    languageIDs: string[];
    ignoreRegExp: string[];
}

interface SPELLMDProblem {
    error: string;
    preContext: string;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    type: string;
    message: string;
    suggestions: string[];
}

// GLOBALS ///////////////////
let settings: SpellMDSettings;
let problems: SPELLMDProblem[] = [];
let CONFIGFILE = vscode.workspace.rootPath + "/.vscode/spell.json";
let SpellChecker = new sc();
let DICT = undefined;
let extensionRoot: string;

export function activate( context: vscode.ExtensionContext )
{
    // Log activate function
    console.log( 'Spellchecker now active!' );
 
    let disposables: vscode.Disposable[];
    
    extensionRoot = context.extensionPath;
    
    // TODO [p2] Currently the only way to refresh is to reload window add a wacher
    settings = GetSettings();
    SetLanguage();

    vscode.commands.registerCommand( 'spellchecker.suggest', Suggest );
    vscode.commands.registerCommand( 'spellchecker.setLanguage', SetLanguage );

    // Link into the two critical lifecycle events
    context.subscriptions.push( vscode.workspace.onDidChangeTextDocument( event => 
    {
        CreateDiagnostics( event.document, event.contentChanges )
    } ) );

    context.subscriptions.push( vscode.workspace.onDidOpenTextDocument( event => 
    {
        CreateDiagnostics( event, undefined )
    } ) );
    
    // console.log( "Test: " + String( SpellChecker.check( 'this' ) ) )
    // console.log( "Test: " + String( SpellChecker.suggest( 'this' ) ) )
}

// this method is called when your extension is deactivated
export function deactivate()
{
    
}

function Suggest()
{
    
}

function SetLanguage()
{
    // console.log( path.join( extensionRoot, 'languages', settings.language + '.aff' ) )
    DICT = SpellChecker.parse(
        {
            aff: fs.readFileSync( path.join( extensionRoot, 'languages', settings.language + '.aff' ) ),
            dic: fs.readFileSync( path.join( extensionRoot, 'languages', settings.language + '.dic' ) )
        });
        
    SpellChecker.use( DICT );
}

function GetSettings() : SpellMDSettings
{
    return {
        language: 'en_US',
        ignoreWordsList: [],
        mistakeTypeToStatus: [],
        languageIDs: [],
        ignoreRegExp: []
    };
}

function CreateDiagnostics( document: vscode.TextDocument, changes: vscode.TextDocumentContentChangeEvent[] )
{
    let startTime = new Date().getTime();
    console.log( 'Starting spell check' );
    
    let diagnostics: vscode.Diagnostic[] = [];
    let errors = vscode.languages.createDiagnosticCollection( "spelling" )
    let problemdict = {};
    
    let textoriginal = document.getText();
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
            
            if( !SpellChecker.check( token ) )
            {
                // console.log( 'Error: \'' + token + '\', line ' + String( linenumber + 1 ) + ', col ' + String( colnumber + 1 ) );
                
                let lineRange = new vscode.Range( linenumber, colnumber, linenumber, colnumber + token.length );

                if( token in problemdict )
                {
                    let diag = new vscode.Diagnostic( lineRange, problemdict[ token ], vscode.DiagnosticSeverity.Error );
                    diagnostics.push( diag );
                }
                else
                {              
                    let message = 'Spelling [ ' + token + ' ]: suggestions [ ';
                    let suggestions = SpellChecker.suggest( token );
                    for( let s of suggestions )
                    {
                        message += s + ', ';
                    }
                    if( suggestions.length > 0 )
                        message = message.slice( 0, message.length - 3 );
                    message += ' ]';
                    
                    // console.log( message );

                    let diag = new vscode.Diagnostic( lineRange, message, vscode.DiagnosticSeverity.Error );
                    diagnostics.push( diag );
                    
                    problemdict[ token ] = message;
                }
            }
        }
    }
    // console.log( diagnostics );
    errors.set( document.uri, diagnostics );
    let endTime = new Date().getTime();
    let minutes = ( endTime - startTime ) / 1000;
    console.log( 'Check completed in ' + String( minutes ) );
    console.log( 'Found ' + String( diagnostics.length ) + ' errors' );
}
