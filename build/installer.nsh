; Undoes the Steam setup when the companion is uninstalled (FR-013, research R6, contracts/command-line.md).
; An update runs the old uninstaller with --updated and must not touch Steam.

; electron-builder includes these two itself only when customCheckAppRunning does not exist; _CHECK_APP_RUNNING needs them.
!include "getProcessInfo.nsh"
Var pid

; Replaces the check that stops every process of the installed folder, which runs before customUnInit: with the game
; open that would stop the keeper. Installing and uninstalling end here, and so does an update (no box when silent).
!macro customCheckAppRunning
  nsExec::Exec `"$CmdPath" /S /C ""$SYSDIR\tasklist.exe" /FI "IMAGENAME eq LegendsOfIdleon.exe" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"LegendsOfIdleon.exe\"""`
  Pop $R0
  ${if} $R0 == 0
    MessageBox MB_OK "Close the game first." /SD IDOK
    Quit
  ${endIf}
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
!macroend

; The boxes of customUnInit have no /SD on purpose: the one-click uninstaller turns silent before this macro runs, and a
; /SD answer would be taken without showing the box.
!macro customUnInit
  ${ifNot} ${isUpdated}
    StrCpy $0 3
    MessageBox MB_YESNO "Steam will close to remove the companion from the launch option of Legends of Idleon. Continue?" IDNO +2
    ExecWait '"$INSTDIR\IdleOn Companion.exe" --remove-from-steam' $0
    ${if} $0 == 2 ; the game opened after customCheckAppRunning
      MessageBox MB_OK "Close the game first."
      Abort
    ${elseif} $0 != 0
      MessageBox MB_OK 'Remove this text from the launch option of Legends of Idleon in Steam:$\r$\n$\r$\n"$INSTDIR\IdleOn Companion.exe" --keeper'
    ${endif}
  ${endif}
!macroend

; The closing box. customUnInstall runs before the files go, the one-click section ends in Quit (so neither
; customUnInstallSection nor un.onUninstSuccess runs), and customRemoveFiles would replace the template's removal. This
; name is not a documented hook: the uninstaller inserts it after the files and the shortcuts go and before the registry
; keys do, and electron-builder generates it only when there are fileAssociations. With any fileAssociations this macro
; is defined twice and the build must fail visibly: move the box then. No /SD on the box, for the reason above.
!macro unregisterFileAssociations
  ${ifNot} ${isUpdated}
    ${if} ${FileExists} "$INSTDIR\*.*"
      MessageBox MB_OK 'IdleOn Companion was uninstalled, but some files could not be removed:$\r$\n$\r$\n$INSTDIR'
    ${else}
      MessageBox MB_OK "IdleOn Companion was uninstalled."
    ${endif}
  ${endif}
!macroend
