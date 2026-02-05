$source = "D:\Projects\Bitrix24-Weekly-View\Bitrix24-Weekly-View"
$destination = "D:\Projects\Bitrix24-Weekly-View\Bitrix24-Weekly-View.zip"
$exclude = @(".github", ".vs", "dist", "node_modules", "obj")

if (Test-Path $destination) {
    Remove-Item $destination -Force
}

$items = Get-ChildItem -Path $source -Force | Where-Object {
    $exclude -notcontains $_.Name
}

Compress-Archive -Path $items.FullName -DestinationPath $destination -Force