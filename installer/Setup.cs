using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class RavandSetup
{
    [STAThread]
    private static void Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(baseDir, "installer", "install.ps1");

        if (!File.Exists(script))
        {
            MessageBox.Show(
                "installer\\install.ps1 was not found next to this file.\r\nKeep Ravand-Setup.exe inside the Ravand project folder.",
                "Ravand Setup",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = "powershell.exe";
        start.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\" -Pause";
        start.WorkingDirectory = baseDir;
        start.UseShellExecute = true;
        start.WindowStyle = ProcessWindowStyle.Normal;

        try
        {
            Process.Start(start);
        }
        catch (Exception ex)
        {
            MessageBox.Show("Could not start the installer:\r\n" + ex.Message, "Ravand Setup",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
