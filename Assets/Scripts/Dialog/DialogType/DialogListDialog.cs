using System;
using System.Collections.Generic;
using System.ComponentModel;
using Dialog.ActionComponent;
using Newtonsoft.Json;

namespace Dialog.DialogType
{
    [Serializable]
    public class DialogListDialog : DialogTypeMain
    {

        [JsonConverter(typeof(FlexibleVariableConverter<DialogTypeMain>))]
        public object dialogs;

        public ActionButton exit_action = null;

        [DefaultValue(2)]
        public int columns = 2;

        [DefaultValue(150)]
        public int button_width = 150;


        DialogListDialog() : base("dialog_list")
        {

        }
    }
}