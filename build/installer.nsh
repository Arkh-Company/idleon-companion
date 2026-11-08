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

; The only hook after the files go: customUnInstall runs before them, and the one-click section ends in Quit, so neither
; customUnInstallSection nor un.onUninstSuccess runs. Defining this macro replaces the template's removal, so that block
; is copied here as it is, update branch included. No /SD on the box, for the reason above.
; ponytail: copy of templates/nsis/uninstaller.nsh of app-builder-lib 26.18.0; compare it when electron-builder changes.
!macro customRemoveFiles
  ${if} ${isUpdated}
    CreateDirectory "$PLUGINSDIR\old-install"

    Push ""
    Call un.atomicRMDir
    Pop $R0

    ${if} $R0 != 0
      DetailPrint "File is busy, aborting: $R0"

      # Attempt to restore previous directory
      Push ""
      Call un.restoreFiles
      Pop $R0

      Abort `Can't rename "$INSTDIR" to "$PLUGINSDIR\old-install".`
    ${endif}

  ${endif}

  # Move out of $INSTDIR so it can be removed
  SetOutPath $TEMP
  # Remove all files (or remaining shallow directories from the block above)
  RMDir /r $INSTDIR

  ${ifNot} ${isUpdated}
    MessageBox MB_OK "IdleOn Companion was uninstalled."
  ${endif}
!macroend
