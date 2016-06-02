'use strict';

import * as vscode from 'vscode';
import SpellCheckerProvider from './features/SpellCheckerProvider';

export function activate( context: vscode.ExtensionContext )
{
    // Log activate function
    console.log( 'Spellchecker now active!' );
 
    // vscode.commands.registerCommand( 'spellchecker.suggest', Suggest );
    // vscode.commands.registerCommand( 'spellchecker.setLanguage', SetLanguage );
    
    let spellchecker = new SpellCheckerProvider();
    spellchecker.activate( context );
    vscode.languages.registerCodeActionsProvider( 'markdown', spellchecker );
    vscode.languages.registerCodeActionsProvider( 'plaintext', spellchecker );   
}

// this method is called when your extension is deactivated
export function deactivate()
{
    
}
