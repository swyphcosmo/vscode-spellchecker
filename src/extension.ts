'use strict';

import * as vscode from 'vscode';
import SpellCheckerProvider from './features/SpellCheckerProvider';

export function activate( context: vscode.ExtensionContext )
{
    // Log activate function
    console.log( 'Spellchecker now active!' );
     
    let spellchecker = new SpellCheckerProvider();
    spellchecker.activate( context );
}

// this method is called when your extension is deactivated
export function deactivate()
{
    
}
