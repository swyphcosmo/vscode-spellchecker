'use strict';

import * as vscode from 'vscode';
import SpellCheckerProvider from './features/SpellCheckerProvider';

export function activate( context: vscode.ExtensionContext )
{
    // Log activate function
    console.log( 'Spellchecker now active!' );
 
    // let disposables: vscode.Disposable[];
    
    // extensionRoot = context.extensionPath;
    
    // // TODO [p2] Currently the only way to refresh is to reload window add a wacher
    // settings = GetSettings();
    // SetLanguage();

    // vscode.commands.registerCommand( 'spellchecker.suggest', Suggest );
    // vscode.commands.registerCommand( 'spellchecker.setLanguage', SetLanguage );

    // // Link into the two critical lifecycle events
    // context.subscriptions.push( vscode.workspace.onDidChangeTextDocument( event => 
    // {
    //     CreateDiagnostics( event.document, event.contentChanges )
    // } ) );

    // context.subscriptions.push( vscode.workspace.onDidOpenTextDocument( event => 
    // {
    //     CreateDiagnostics( event, undefined )
    // } ) );
    
    let spellchecker = new SpellCheckerProvider();
    spellchecker.activate( context );
    vscode.languages.registerCodeActionsProvider( 'markdown', spellchecker );
    vscode.languages.registerCodeActionsProvider( 'plaintext', spellchecker );
    
    // console.log( "Test: " + String( SpellChecker.check( 'this' ) ) )
    // console.log( "Test: " + String( SpellChecker.suggest( 'this' ) ) )
}


// export function registerCodeActionCommands(client: LanguageClient): void {
//     vscode.commands.registerCommand('PowerShell.ApplyCodeActionEdits', (edit: any) => {
//         console.log("Applying edits");
//         console.log(edit);
//         CodeActionProvider 

//         var workspaceEdit = new vscode.WorkspaceEdit();
//         workspaceEdit.set(
//             vscode.Uri.file(edit.File),
//             [
//                 new vscode.TextEdit(
//                     new vscode.Range(
//                         edit.StartLineNumber - 1,
//                         edit.StartColumnNumber - 1,
//                         edit.EndLineNumber - 1,
//                         edit.EndColumnNumber - 1),
//                     edit.Text)
//             ]);
//         vscode.workspace.applyEdit(workspaceEdit);
//     });
// }

// this method is called when your extension is deactivated
export function deactivate()
{
    
}

function Suggest()
{
    
}

// function CreateDiagnostics( document: vscode.TextDocument, changes: vscode.TextDocumentContentChangeEvent[] )
// {
   
// }
