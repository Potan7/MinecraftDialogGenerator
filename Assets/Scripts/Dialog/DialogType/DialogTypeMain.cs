using UnityEngine;
using System;
using Newtonsoft.Json;
using Dialog.TextComponent;
using Dialog.BodyComponent;
using System.Collections.Generic;
using System.ComponentModel;

namespace Dialog.DialogType
{
    [Serializable]
    public abstract class DialogTypeMain
    {
        [JsonProperty(Order = -10)]
        public readonly string type;

        [JsonConverter(typeof(TextComponentConverter))]
        [JsonProperty(Order = -9)]
        public object title = "";

        [JsonConverter(typeof(TextComponentConverter))]
        [JsonProperty(Order = -8)]
        private object external_title = null;
        public object ExternalTitle
        {
            get => external_title;
            set
            {
                if (value is string str && string.IsNullOrEmpty(str))
                {
                    external_title = null;
                    return;
                }

                external_title = value;
            }
        }

        [JsonConverter(typeof(FlexibleVariableConverter<BodyComponentAbstract>))]
        [JsonProperty(Order = -7)]
        public object body = null;

        [JsonProperty(Order = -6)]
        public List<BodyComponentAbstract> inputs = null;

        [DefaultValue(true)]
        [JsonProperty(Order = -5)]
        public bool can_close_with_escape = true;

        [DefaultValue(true)]
        [JsonProperty(Order = -4)]
        public bool pause = true;

        [DefaultValue(AfterAction.close)]
        [JsonProperty(Order = -3)]
        public AfterAction after_action = AfterAction.close;

        
        public Dictionary<string, object> extra = null;

        public DialogTypeMain(string name)
        {
            type = "minecraft:" + name;
        }
    }
}