; Point shortcuts at resources\icon.ico so Windows does not keep showing a
; cached Electron icon from a previous install of the same exe path (exe,0).
!macro customInstall
  CreateShortCut "$DESKTOP\Millie's Supermarket.lnk" "$INSTDIR\MilliesSupermarket.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Millie's Supermarket.lnk" "$INSTDIR\MilliesSupermarket.exe" "" "$INSTDIR\resources\icon.ico" 0
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
