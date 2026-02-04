$files = Get-ChildItem -Recurse -File -Path "src" -Include *.ts,*.vue

$changed = 0

foreach ($f in $files) {
    $text = Get-Content -LiteralPath $f.FullName -Raw

    # Remove ".js" before quote in import paths
    $newText = $text -replace "\.js(['""])", '$1'

    if ($newText -ne $text) {
        Set-Content -LiteralPath $f.FullName -Value $newText -NoNewline
        $changed++
        Write-Host "Fixed:" $f.FullName
    }
}

Write-Host ""
Write-Host "Done. Updated $changed files."
