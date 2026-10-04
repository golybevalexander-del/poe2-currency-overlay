' Launches this Direct Barter fork's local Electron build without downloading anything.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
electron = fso.BuildPath(dir, "node_modules\electron\dist\electron.exe")
bundle = fso.BuildPath(dir, "renderer\item-tab.bundle.js")
If Not fso.FileExists(electron) Or Not fso.FileExists(bundle) Then
  MsgBox "Local build is missing. Restore dependencies with npm ci and run npm run build:item first.", vbExclamation, "POE2 Direct Barter Fork"
  WScript.Quit 1
End If
sh.Run """" & electron & """ .", 0, False
