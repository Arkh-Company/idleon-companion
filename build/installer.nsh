; Undoes the Steam setup when the companion is uninstalled (FR-013, research R6, contracts/command-line.md).
; An update runs the old uninstaller with --updated and must not touch Steam.
; The boxes have no /SD on purpose: the one-click uninstaller turns silent before this macro runs, and a /SD answer
; would be taken without showing the box.
!macro customUnInit
  ${ifNot} ${isUpdated}
    StrCpy $0 3
    MessageBox MB_YESNO "Steam will close to remove the companion from the launch option of Legends of Idleon. Continue?" IDNO +2
    ExecWait '"$INSTDIR\IdleOn Companion.exe" --remove-from-steam' $0
    ${if} $0 == 2
      MessageBox MB_OK "Close the game first."
      Abort
    ${elseif} $0 != 0
      MessageBox MB_OK 'Remove this text from the launch option of Legends of Idleon in Steam:$\r$\n$\r$\n"$INSTDIR\IdleOn Companion.exe" --keeper'
    ${endif}
  ${endif}
!macroend
