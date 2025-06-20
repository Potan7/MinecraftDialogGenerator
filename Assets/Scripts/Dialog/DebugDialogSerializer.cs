using Dialog.DialogType;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;


public class DebugDialogSerializer : MonoBehaviour
{

    public JsonSerializerSettings exportSettings = new JsonSerializerSettings
    {
        // JSON 직렬화 설정
        Formatting = Formatting.Indented,
        NullValueHandling = NullValueHandling.Ignore,
        DefaultValueHandling = DefaultValueHandling.Ignore
    };

    public JsonSerializerSettings inlineExportSettings = new JsonSerializerSettings
    {
        // JSON 직렬화 설정
        Formatting = Formatting.None,
        NullValueHandling = NullValueHandling.Ignore,
        DefaultValueHandling = DefaultValueHandling.Ignore
    };

    public ConfirmationDialog confirmationDialog;

    [ContextMenu("Serialize Confirmation Dialog")]
    public void SerializeConfirmationDialog()
    {
        string json = JsonConvert.SerializeObject(confirmationDialog, exportSettings);
        Debug.Log("Serialized Confirmation Dialog: " + json);
    }
}