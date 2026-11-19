using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

internal static class RavandLauncher
{
    private static bool IsListening(int port)
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                bool connected = result.AsyncWaitHandle.WaitOne(400);
                if (!connected) return false;
                client.EndConnect(result);
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    private static string FindNode()
    {
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string candidate = Path.Combine(pf, "nodejs", "node.exe");
        if (File.Exists(candidate)) return candidate;

        string path = Environment.GetEnvironmentVariable("PATH");
        if (path != null)
        {
            foreach (string part in path.Split(Path.PathSeparator))
            {
                try
                {
                    string exe = Path.Combine(part.Trim(), "node.exe");
                    if (File.Exists(exe)) return exe;
                }
                catch { }
            }
        }
        return null;
    }

    [STAThread]
    private static void Main(string[] args)
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        int port = 3000;
        bool openBrowser = true;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--port" && i + 1 < args.Length)
            {
                int parsed;
                if (int.TryParse(args[i + 1], out parsed)) port = parsed;
            }
            if (args[i] == "--no-browser") openBrowser = false;
        }

        string envFile = Path.Combine(baseDir, ".env");
        string nextBin = Path.Combine(baseDir, "node_modules", "next", "dist", "bin", "next");
        bool configured = File.Exists(envFile)
            && !File.ReadAllText(envFile).Contains("change_me_local")
            && File.Exists(Path.Combine(baseDir, ".next", "BUILD_ID"))
            && File.Exists(nextBin);

        if (!configured)
        {
            string setup = Path.Combine(baseDir, "Ravand-Setup.exe");
            if (File.Exists(setup))
            {
                try
                {
                    ProcessStartInfo setupStart = new ProcessStartInfo(setup);
                    setupStart.WorkingDirectory = baseDir;
                    setupStart.UseShellExecute = true;
                    Process.Start(setupStart);
                    return;
                }
                catch { }
            }

            MessageBox.Show(
                "Ravand is not installed yet. Run Ravand-Setup.exe first.",
                "Ravand", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (!IsListening(port))
        {
            string node = FindNode();
            if (node == null)
            {
                MessageBox.Show(
                    "Node.js was not found. Run Ravand-Setup.exe again.",
                    "Ravand", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string next = Path.Combine(baseDir, "node_modules", "next", "dist", "bin", "next");
            if (!File.Exists(next))
            {
                MessageBox.Show(
                    "The application is not built yet. Run Ravand-Setup.exe first.",
                    "Ravand", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = node;
            start.Arguments = "\"" + next + "\" start -H 127.0.0.1 -p " + port;
            start.WorkingDirectory = baseDir;
            start.CreateNoWindow = true;
            start.UseShellExecute = false;
            start.WindowStyle = ProcessWindowStyle.Hidden;

            try { Process.Start(start); }
            catch (Exception ex)
            {
                MessageBox.Show("Could not start Ravand:\r\n" + ex.Message,
                    "Ravand", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            for (int i = 0; i < 60 && !IsListening(port); i++) Thread.Sleep(500);
        }

        if (openBrowser)
        {
            try
            {
                ProcessStartInfo browser = new ProcessStartInfo("http://localhost:" + port);
                browser.UseShellExecute = true;
                Process.Start(browser);
            }
            catch { }
        }
    }
}
