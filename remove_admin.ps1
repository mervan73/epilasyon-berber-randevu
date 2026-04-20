$lines = [System.Collections.Generic.List[string]](Get-Content app.py)
$result = New-Object System.Collections.Generic.List[string]
$skipPanel = False
$skipAdmin = False
foreach ($line in $lines) {
    if (-not $skipPanel -and $line -like  *@app.route /admin-panel *) {
        $skipPanel = True
        continue
    }
    if ($skipPanel) {
        if ($line -like *return render_template*admin_panel.html*) {
            $skipPanel = False
        }
        continue
    }
    if (-not $skipAdmin -and $line -like *@app.route /api/admin/isletmeler *) {
        $skipAdmin = True
        continue
    }
    if ($skipAdmin) {
        if ($line -like *@app.route /api/public/isletmeler *) {
            $skipAdmin = False
            $result.Add($line)
        }
        continue
    }
    $result.Add($line)
}
Set-Content -Encoding UTF8 app.py $result
