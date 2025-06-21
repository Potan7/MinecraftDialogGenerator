
using System;
using System.Collections.Generic;
using System.ComponentModel;
using Dialog.ActionComponent;

namespace Dialog.DialogType
{
    [Serializable]
    public class MultiActionDialog : DialogTypeMain
    {

        public List<ActionButton> actions;

        [DefaultValue(2)]
        public int columns = 2;

        public ActionButton exit_action = null;
        

        MultiActionDialog() : base("multi_action")
        {

        }
    }
}