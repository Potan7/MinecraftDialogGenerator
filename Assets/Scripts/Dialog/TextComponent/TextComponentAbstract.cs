using UnityEngine;
using System;
using System.ComponentModel;
using System.Collections.Generic;

namespace Dialog.TextComponent
{
    [Serializable]
    public abstract class TextComponentAbstract
    {
        [DefaultValue("white")]
        public string color = "white";
        [DefaultValue("minecraft:default")]
        public string font = "minecraft:default";
        [DefaultValue(false)]
        public bool bold = false;
        [DefaultValue(false)]
        public bool italic = false;
        [DefaultValue(false)]
        public bool underlined = false;
        [DefaultValue(false)]
        public bool strikeThrough = false;
        [DefaultValue(false)]
        public bool obfuscated = false;

        public object shadow_color = null;

        public object extra = null;

        public Dictionary<string, object> clickEvent = null;
        public Dictionary<string, object> hoverEvent = null;
    }
}