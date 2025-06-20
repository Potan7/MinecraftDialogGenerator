
using System.ComponentModel;
using Dialog.TextComponent;
using Newtonsoft.Json;

namespace Dialog.ActionComponent
{
    [System.Serializable]
    public class ActionButton
    {
        [JsonConverter(typeof(TextComponentConverter))]
        public object label = "";

        [JsonConverter(typeof(TextComponentConverter))]
        public object tooltip = null;

        [DefaultValue(150)]
        public int width = 150;

        public ActionAbstract action = null;

    }
}